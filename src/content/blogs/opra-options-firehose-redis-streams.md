---
title: "Ingesting the OPRA options firehose with Redis Streams without dropping messages"
description: "How we ingest US options (OPRA) data on Redis Streams: bounded queues, pipelined batch writes, two-tier trade sentiment, burst detection and self-healing feeds."
pubDate: 2026-07-08
tags: ["Market data", "Redis Streams", "Python", "FinTech", "Real-time"]
services: ["fintech-software-development"]
caseStudy: "real-time-options-flow-pipeline"
---

To ingest the OPRA options firehose without dropping messages, decouple the feed reader from storage with a bounded in-memory queue, write to Redis Streams in large pipelined batches over a dedicated connection pool per stream, and alert on every message you are forced to drop. On top of that, aggregate in parallel, classify trades with a fallback strategy, re-check them after the fact, and restart any feed that stalls. This article walks through the pipeline we built for an options analytics platform and the engineering decisions behind each stage.

## Key takeaways

- **Backpressure must be explicit.** A bounded 50,000-item queue sits between the feed and Redis. When it is full, we drop, count and alert, instead of letting memory grow until the process dies.
- **Batch and pipeline every write.** Writes go to Redis in pipelined batches of up to 5,000 messages, with a connection pool per stream so one hot stream cannot starve the others.
- **Classify trades in two tiers, then correct them.** Bid/ask spread first, tick rule as fallback, and a correction pass five minutes after each trade.
- **Watch for bursts and stalls separately.** Burst detection runs on 200 ms buckets. A watchdog restarts any stalled feed within three minutes.
- **Harden Redis for scale.** Memory limits and a deliberate eviction policy keep a store with more than 10 million keys stable.

## Why is the OPRA feed hard to ingest?

OPRA (Options Price Reporting Authority) consolidates trades and quotes from every US options exchange into one feed. It is one of the highest-volume public market data feeds in the world, and its volume is uneven. The market open, major economic releases and sudden moves in large underlyings all produce bursts far above the daily average.

That shape is the core problem. A pipeline sized for average load falls behind during bursts. A pipeline that blocks the feed reader while waiting on storage falls behind further, because the upstream connection keeps delivering. The previous system on this project failed in exactly that way: it dropped messages and stalled silently, so dashboards showed stale or incomplete flow at the moments traders cared about most.

## How do you avoid dropping messages during bursts?

The answer is to separate reading from writing and make the boundary between them explicit.

**A bounded queue between the reader and the writer.** The feed reader does as little as possible: parse, normalize, enqueue. A writer thread drains the queue into Redis. The queue holds at most 50,000 items. That bound is deliberate. An unbounded queue hides problems until the process runs out of memory; a bounded one forces a decision.

**Drops are counted and alerted, never silent.** If the queue is full, the message is dropped, a counter increments and an alert fires. In normal operation the counter stays at zero. If it moves, someone knows immediately, which is the opposite of the silent stalls the old system suffered.

**Pipelined batch writes.** Sending one command per message wastes most of the time on network round trips. The writer collects up to 5,000 messages and sends them as a single Redis pipeline, so the cost of a round trip is shared across the whole batch.

**A connection pool per stream.** Trades, quotes and dark pool prints have different volumes. Giving each stream its own connection pool isolates them, so a burst on one stream does not starve writes to another.

```python
# Illustrative only: bounded queue + pipelined batch writes to a Redis Stream.
import queue, threading, redis

MAX_QUEUE = 50_000
BATCH_SIZE = 5_000

class StreamWriter:
    def __init__(self, stream: str, pool: redis.ConnectionPool, on_drop):
        self.stream = stream
        self.q: queue.Queue[dict] = queue.Queue(maxsize=MAX_QUEUE)
        self.r = redis.Redis(connection_pool=pool)  # one pool per stream
        self.on_drop = on_drop
        threading.Thread(target=self._drain, daemon=True).start()

    def put(self, msg: dict) -> None:
        try:
            self.q.put_nowait(msg)
        except queue.Full:
            self.on_drop(self.stream)  # count it and alert; never fail silently

    def _drain(self) -> None:
        while True:
            batch = [self.q.get()]  # block for the first item
            while len(batch) < BATCH_SIZE:
                try:
                    batch.append(self.q.get_nowait())
                except queue.Empty:
                    break
            pipe = self.r.pipeline(transaction=False)
            for msg in batch:
                pipe.xadd(self.stream, msg, maxlen=1_000_000, approximate=True)
            pipe.execute()
```

The `maxlen` with approximate trimming keeps each stream bounded in memory without the cost of exact trimming on every write. The exact cap depends on how far back consumers need to read.

## How do you turn raw prints into live analytics?

Raw prints are not what traders look at. They look at aggregated flow: premium by ticker, call and put activity, sweeps, unusual size. We compute those views on a **60-second aggregation cycle spread across 8 parallel jobs**. Partitioning the work lets each job finish well within its window even at peak volume, and a slow partition does not hold up the others.

Aggregated results are published to the platform's real-time layer and **fanned out over WebSockets to more than 100 routes** that feed the analytics pages. The ingestion pipeline and the fan-out are separate concerns: ingestion is optimized for throughput and durability, fan-out for many concurrent subscribers.

## How do you classify options trade sentiment?

Whether a trade was buyer-initiated or seller-initiated is one of the most useful signals in options flow, and the exchange does not report it. It has to be inferred. We use a two-tier approach.

**Tier one: the quote rule, using the bid/ask spread.** If a trade prints at or above the ask, it was most likely buyer-initiated. At or below the bid, seller-initiated. Between the two, the side it is closer to wins. This works whenever a reliable quote is available at the time of the trade.

**Tier two: the tick rule as a fallback.** When the quote is missing, stale or crossed, we compare the trade price with the previous trade in the same contract. An uptick suggests a buy and a downtick a sell. On an unchanged price, we carry the direction of the last price change.

```python
# Illustrative only: two-tier trade side classification.
def classify(price, bid, ask, prev_price, prev_side):
    if bid and ask and 0 < bid < ask:
        if price >= ask: return "buy"
        if price <= bid: return "sell"
        mid = (bid + ask) / 2
        if price > mid: return "buy"
        if price < mid: return "sell"
    # Fallback: tick rule
    if prev_price is None: return "unknown"
    if price > prev_price: return "buy"
    if price < prev_price: return "sell"
    return prev_side or "unknown"
```

**A correction pass five minutes later.** Market data is not final the instant it arrives. Late prints, cancellations and quote context that arrives out of order can all change the right answer. Five minutes after each trade, a correction pass re-evaluates it and updates the classification and any affected aggregates. Users get a fast first answer and an accurate settled one.

## How do you detect bursts and avoid alert storms?

**Burst detection on 200 ms buckets.** Bursts are where both trading signals and operational risk live. We count activity in 200 ms buckets and flag buckets that stand far above the recent baseline. Small buckets catch sweeps and sudden surges that a per-second or per-minute counter would smooth away.

**Atomic alert cooldowns.** Once an alert fires for a contract or ticker, it should not fire again for every subsequent print in the same burst. Several workers may evaluate the same condition at the same moment, so the cooldown has to be atomic. Redis `SET` with `NX` and an expiry does this in a single command: only the first worker to claim the key sends the alert.

```python
# Illustrative only: atomic cooldown, safe across many workers.
def should_alert(r, key: str, cooldown_s: int) -> bool:
    return bool(r.set(f"cooldown:{key}", 1, nx=True, ex=cooldown_s))
```

## What happens when a feed stalls?

Feeds stall. Upstream connections hang without closing, sockets go half-open, a dependency restarts. The dangerous failure is the quiet one, where the process is alive but no data flows.

Each feed reports a heartbeat based on messages actually processed, not on the process being up. A watchdog compares the heartbeat with what market hours imply. If a feed goes quiet when it should not, the watchdog restarts it, and the pipeline **recovers a stalled feed within three minutes** without anyone being paged at 9:31 a.m. The restart is logged and alerted so the underlying cause still gets investigated.

## How do you harden Redis for more than 10 million keys?

At this scale, Redis defaults are not a plan. Two settings matter most.

**A memory limit.** Without `maxmemory`, Redis grows until the operating system intervenes. With a limit, behavior under pressure is predictable.

**A deliberate eviction policy.** What Redis does at the limit has to match the data. Streams that feed live dashboards and state that must not disappear should not be eligible for eviction, while caches and short-lived keys should. A volatile policy, which only evicts keys that have an expiry, combined with expiries set on every cache-like key, makes that distinction explicit.

The broader rule: every key family should have a known owner, a known size and a known lifetime.

## Need a market data pipeline that holds up at the open?

The patterns here, explicit backpressure, batched writes, layered classification, watchdogs and a hardened store, apply to any high-volume real-time feed, not only options. Read the [case study of the real-time options flow and dark pool pipeline](/work/real-time-options-flow-pipeline/) for the full system, or see our [FinTech software development services](/services/fintech-software-development/) for how we build trading and market data platforms.
