---
title: "Building a real-time voice AI assistant: latency, tools and cost control"
seoTitle: "Real-Time Voice AI: Latency, Tools and Cost Control"
description: "How we built a real-time voice AI assistant with Gemini Live and ElevenLabs: a provider-independent WebSocket layer, 56 concurrent tools and hard spend caps."
pubDate: 2026-09-15
tags: ["Voice AI", "Gemini Live", "ElevenLabs", "Django Channels", "asyncio"]
services: ["voice-ai-development", "ai-agent-development"]
caseStudy: "voice-ai-trading-assistant"
---

A real-time voice AI assistant feels fast when audio streams in both directions over a persistent WebSocket, the voice engine sits behind a provider-independent interface, and every tool call in a turn runs concurrently instead of one after another. It stays affordable when every session is metered and spend caps are enforced on the server before a model is called. We built exactly that for a trading analytics product: Gemini Live native audio and ElevenLabs behind one interface, 56 tools and weekly and monthly spend caps, covered by more than 1,500 automated tests.

## Key takeaways

- **Latency is the product.** In voice, a pause reads as failure. Streaming audio both ways and running tool calls concurrently are what keep replies feeling natural.
- **Own the transport, abstract the engine.** Our WebSocket layer on Django Channels does not know which voice engine is on the other side. Gemini Live and ElevenLabs plug in behind one interface.
- **Run a turn's tool calls in parallel.** With 56 tools available, a single spoken question often needs several of them. `asyncio.gather` turns the slowest call, not the sum of all calls, into the wait.
- **Meter everything, cap everything.** Usage metering, weekly and monthly spend caps and prepaid credits are checked server-side before work starts.
- **Test like it handles money.** JWT, MFA, Nginx rate limiting and a suite of 1,500+ automated tests are what let us change a real-time system with confidence.

## Why is latency the hardest problem in voice AI?

In a chat interface, a two-second pause before text appears is tolerable. In a voice conversation, the same pause feels like the assistant did not hear you. Users start repeating themselves, talking over the reply, or giving up.

Latency in a voice assistant comes from several places that add up: capturing and sending audio, the model detecting the end of the user's speech, the model deciding what to do, any tool calls it makes, generating the spoken reply and playing it back. You cannot eliminate any of these, but you can avoid adding to them. Our design choices all follow from that principle:

- Keep one persistent, bidirectional connection open for the whole session, so there is no connection setup per turn.
- Use engines that produce audio natively or stream it as it is generated, so playback starts before the full reply exists.
- Never make the user wait for tool calls in sequence when they could run at the same time.

## How do you make a voice assistant independent of the AI provider?

Voice engines evolve quickly, and they differ in voices, languages, pricing and behavior. Locking the whole product to one engine is a business risk. So we separated two layers that are easy to blur together.

**The transport layer** is ours. The browser streams microphone audio to the backend over a WebSocket handled by **Django Channels**, and receives audio and live transcript events back on the same connection. This layer handles authentication, session state, reconnection, metering and tool execution. It does not know which voice engine is in use.

**The engine layer** is pluggable. **Gemini Live native audio** and **ElevenLabs** each sit behind the same interface: start a session, send audio, receive audio and transcript events, receive tool calls, return tool results, end the session. Each adapter translates between that interface and the engine's own protocol.

```python
# Illustrative only: the interface every voice engine adapter implements.
from typing import AsyncIterator, Protocol

class VoiceEngine(Protocol):
    async def start(self, session_config: dict) -> None: ...
    async def send_audio(self, chunk: bytes) -> None: ...
    def events(self) -> AsyncIterator["EngineEvent"]: ...  # audio, transcript, tool_call, turn_end
    async def send_tool_results(self, results: list["ToolResult"]) -> None: ...
    async def close(self) -> None: ...
```

The payoff is practical. An engine can be selected per user or per plan, new engines can be added without touching the WebSocket consumer, and the live transcript, metering and tools behave identically regardless of which engine is speaking.

## How do 56 tools stay fast in a spoken conversation?

The assistant can call 56 tools that pull live market data and account context mid-conversation. A natural spoken question like "how is the market looking, and what is happening with my watchlist?" may require several of them: an index snapshot, a watchlist lookup, a quote for each symbol and recent options activity.

Modern realtime models can request several function calls in a single turn. If the backend executes them one after another, the user waits for the sum of every call. If it executes them concurrently, the user waits for roughly the slowest one. In voice, that difference is the gap between a natural reply and an awkward silence.

We run all of a turn's tool calls concurrently with `asyncio`. Each call gets its own timeout, and one failing tool does not sink the others: the model receives an error result for that call and can still answer with what it has.

```python
# Illustrative only: run every tool call in a turn concurrently.
import asyncio

TOOL_TIMEOUT_S = 8

async def run_tool(call, registry, ctx):
    tool = registry.get(call.name)
    if tool is None:
        return {"id": call.id, "error": f"unknown tool {call.name}"}
    try:
        args = tool.validate(call.args)  # server-side validation and limits
        result = await asyncio.wait_for(tool.run(args, ctx), TOOL_TIMEOUT_S)
        return {"id": call.id, "result": result}
    except asyncio.TimeoutError:
        return {"id": call.id, "error": "timed out"}
    except Exception as exc:  # report, never crash the turn
        return {"id": call.id, "error": str(exc)}

async def run_turn_tools(calls, registry, ctx):
    return await asyncio.gather(*(run_tool(c, registry, ctx) for c in calls))
```

A few details matter as much as the concurrency itself:

- **Tools are async end to end.** A single blocking database call or HTTP request inside a tool stalls the event loop and every other session on that worker. Blocking work is moved off the loop or replaced with async clients.
- **Results are compact.** The model reads every tool result before it speaks. Short, structured results mean less processing before audio starts.
- **Tool arguments are validated on the server.** The model proposes arguments; the server enforces types and limits before anything runs.

## How do you stop voice AI costs from running away?

Voice sessions are long-lived and billed by usage, which makes them easy to underestimate. A user who leaves a session open, a client bug that reconnects in a loop or a heavy user on a flat plan can all create costs nobody planned for. We treat cost control as part of the core design.

**Usage metering.** Every session records the usage the engines report, attributed to the user, the session and the engine. That data drives both billing and limits.

**Weekly and monthly spend caps.** Each user has caps over two windows. The weekly cap catches sudden spikes early; the monthly cap bounds the total. Both are checked server-side before a session starts and while it runs, so limits hold even if the client misbehaves.

**Prepaid credits.** Users can buy credits that are drawn down as they use the assistant. Credits give heavy users a clear way to keep going without the product absorbing open-ended cost.

```python
# Illustrative only: gate a session before any model call is made.
def can_start_session(user, usage) -> tuple[bool, str | None]:
    if usage.week_spend >= user.weekly_cap and user.credit_balance <= 0:
        return False, "weekly_cap_reached"
    if usage.month_spend >= user.monthly_cap and user.credit_balance <= 0:
        return False, "monthly_cap_reached"
    return True, None
```

The important property is that enforcement lives on the server, in the same path that opens the engine session. There is no route to the model that skips the check.

## How do you deploy and secure a real-time voice backend?

The stack runs with **Docker Compose behind Nginx**. Nginx terminates TLS, proxies WebSocket upgrades to the Channels workers and applies **rate limiting**, so abusive clients are throttled before they reach the application.

Authentication uses **JWT**, including on the WebSocket handshake, so every audio session is tied to a verified user before any audio is processed. Accounts are protected with **MFA**, which matters for a product connected to financial data and paid usage.

## Why does a voice AI product need 1,500+ automated tests?

Real-time systems fail in ways that are hard to reproduce by hand: a tool timing out mid-turn, a reconnect during playback, a spend cap reached halfway through a session, an engine returning an unexpected event. The product is covered by **more than 1,500 automated tests** across tool behavior, metering and cap enforcement, authentication, WebSocket consumers and engine adapters.

Two habits make a suite like this valuable rather than just large. Engine adapters should be exercised against simulated event sequences, so behavior is verified without calling a paid API on every run. And a bug found in production should become a test before it is fixed. That discipline is what makes it safe to add tools, change engines and adjust pricing logic without breaking a live conversation.

## Planning a voice assistant for your product?

Voice is one of the most demanding interfaces to build for AI, because latency, reliability and cost are all visible to the user at once. Read the [case study of the real-time voice AI assistant with 56 tools](/work/voice-ai-trading-assistant/) for the full system, or see our [voice AI development services](/services/voice-ai-development/) for how we design, build and harden real-time voice agents.
