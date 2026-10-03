---
title: "How we build production AI agents on Claude and AWS Bedrock"
description: "Lessons from eight versions of a production AI research agent on Claude via AWS Bedrock: one deep agent, 16 tools, guardrails, tracing and cost metering."
pubDate: 2026-03-17
updatedDate: 2026-08-11
tags: ["AI agents", "Claude", "AWS Bedrock", "LangGraph", "LLMOps"]
services: ["ai-agent-development", "fintech-software-development"]
caseStudy: "ai-options-analytics-platform"
---

We build production AI agents on Claude through AWS Bedrock as a single deep agent with a small set of typed tools, server-side guardrails, Postgres-backed conversation state and a deterministic engine for every number the user sees. Streaming, prompt caching, LangFuse tracing and per-request cost metering are part of the first release, not a later hardening phase. This article explains how we arrived at that design by taking one AI research agent for an options analytics platform through eight versions.

## Key takeaways

- **Start simple, then earn complexity.** Our agent went from semantic routing, to multi-agent, to a single deep agent built with LangGraph and DeepAgents. The simplest architecture that passed our evaluations won.
- **Tools are the product.** Sixteen well-scoped tools beat a larger catalog of overlapping ones. Limits on tool arguments are enforced on the server, never in the prompt.
- **The model never does arithmetic.** A deterministic scoring engine computes every figure. The model retrieves, explains and reasons about those results.
- **Guardrails are code.** Prompt-leak detection, automatic context summarization and argument limits run outside the model.
- **Cost is a feature.** Prompt caching plus per-request cost metering with price snapshots made spend predictable and auditable.

## What makes an AI agent "production" rather than a demo?

A demo agent answers the questions its builder thought of. A production agent answers questions from paying users, at market open, on a model provider that occasionally throttles, with a finance team asking what each answer cost. For us that translates into a short list of non-negotiables:

1. Answers stream token by token, so users see progress within the first second or two.
2. Conversations survive a page refresh, a deploy or a dropped connection.
3. Every number shown to a user can be traced to deterministic code and source data.
4. Every request has a trace and a cost attached to it.
5. The agent cannot be talked into revealing its instructions or calling a tool with unreasonable inputs.

Everything below is how we met those requirements on Claude running in AWS Bedrock.

## Why did we move from multi-agent to a single deep agent?

The agent went through eight versions. The architecture changed three times, and each change was driven by evaluation results and production traces rather than by framework fashion.

**Semantic routing came first.** An embedding-based router classified each question and sent it to a specialized prompt with a narrow tool set. It was cheap and fast, and it worked well for single-intent questions. It broke on the questions traders actually ask, which usually combine intents: "compare unusual call activity in these three tickers and tell me which has the most bullish positioning." A router has to pick one lane, and that question lives in several.

**Multi-agent was second.** A supervisor delegated to specialist sub-agents, each owning one research area, then merged their findings. Coverage improved, but three problems appeared in our traces:

- **Context loss at handoffs.** Each specialist saw a summary of the task, not the full conversation, so follow-up questions lost nuance.
- **Duplicated tool calls.** Specialists independently fetched overlapping data, which added latency and tokens.
- **Harder debugging.** When an answer was wrong, the root cause could sit in the supervisor's plan, a specialist's interpretation or the merge step.

**A single deep agent was third, and it stuck.** We rebuilt the agent on LangGraph using the DeepAgents harness: one capable model with the full conversation, an explicit planning step, and the complete tool set. Claude is strong at multi-step tool use when it can see the whole problem, so the gains came from removing handoffs, not from adding orchestration. One agent also means one trace per request, which made every later improvement easier to measure.

The lesson we carry into every engagement: multi-agent designs are a tool for genuinely separable work or hard isolation requirements, not a default. We choose the architecture from an evaluation set built on the client's real questions.

## How do you design the tool layer for an AI agent?

The research agent has 16 tools. Each one wraps a specific capability of the platform: querying options flow, reading volatility data, pulling market context, running the scoring engine and so on. A few rules shaped them.

**One clear job per tool.** If two tools could plausibly answer the same question, the model will sometimes pick the wrong one. We merged or renamed tools until every tool description read as distinct.

**Typed inputs with server-side limits.** The model proposes arguments; the server decides what is acceptable. Date ranges, result counts and ticker lists all have hard ceilings enforced in code. A prompt that says "never request more than 50 rows" is a suggestion. A validator that clamps the value is a guarantee.

```python
# Illustrative: argument limits live on the server, not in the prompt.
from pydantic import BaseModel, Field, field_validator

MAX_TICKERS = 10
MAX_LOOKBACK_DAYS = 30

class FlowQuery(BaseModel):
    tickers: list[str] = Field(min_length=1)
    lookback_days: int = Field(default=1, ge=1)

    @field_validator("tickers")
    @classmethod
    def cap_tickers(cls, v: list[str]) -> list[str]:
        return [t.upper().strip() for t in v][:MAX_TICKERS]

    @field_validator("lookback_days")
    @classmethod
    def cap_lookback(cls, v: int) -> int:
        return min(v, MAX_LOOKBACK_DAYS)
```

**Compact, structured results.** Tools return the fields the model needs to reason, not raw API payloads. Smaller tool results mean faster turns, lower cost and less room for the model to latch onto irrelevant data.

## Why should the model never calculate the numbers?

Language models are good at explaining numbers and unreliable at producing them. In a financial product, a confidently wrong percentage destroys trust faster than any other failure.

So we moved every calculation out of the model. A deterministic scoring engine computes scores, ratios and aggregates from source data, and the agent calls it as a tool. The model's job is to choose what to compute, then interpret and explain the output. When a user asks why a ticker scored the way it did, the answer is grounded in the same code that drives the rest of the platform, and the numbers can be reproduced exactly.

This also makes evaluation tractable. We can test the scoring engine with ordinary unit tests and evaluate the agent separately on whether it called the right tools and explained the results faithfully.

## How do we stream responses and keep conversation state?

Responses stream token by token over WebSockets on Django Channels, the same real-time layer the platform already uses for live data. Users see the agent's answer forming immediately, and tool activity is surfaced as it happens so a longer research turn never looks frozen.

Conversation state lives in Postgres, not in process memory. Each message, tool call and tool result is persisted, which gives us three things: conversations survive deploys and reconnects, support can replay exactly what a user saw, and long conversations can be summarized and resumed without losing the thread.

## What guardrails does a production agent need?

We treat guardrails as ordinary backend code with tests, not as paragraphs in a system prompt.

- **Server-side tool argument limits**, as shown above, bound the cost and blast radius of any single tool call.
- **Prompt-leak detection** inspects outgoing responses for fragments of the system prompt and internal instructions, and blocks them before they reach the user. Users will try to extract the prompt; the server is what stops them.
- **Automatic context summarization** kicks in as a conversation approaches the context budget. Older turns are condensed into a summary while recent turns and key facts stay verbatim, so long research sessions keep working without truncation errors or runaway token counts.

## How do you keep LLM costs predictable?

Two mechanisms do most of the work.

**Prompt caching.** The system prompt and tool definitions are large and identical across requests. Bedrock's prompt caching for Claude lets us mark that stable prefix as cacheable, so repeated requests reuse it at a lower rate and with lower latency. The design rule is simple: put stable content first, volatile content last, and never interpolate per-request values into the cached prefix.

**Per-request cost metering with price snapshots.** Every model call records input, output and cache token counts against the price that applied at that moment. Storing a price snapshot with each record, rather than multiplying by today's price at report time, keeps historical cost accurate when model pricing or the model itself changes. The result is a per-request, per-user and per-feature cost view that finance can trust.

```python
# Illustrative: record cost with the price that applied at call time.
def record_usage(db, request_id, model_id, usage, price):
    cost = (
        usage.input_tokens * price.input_per_token
        + usage.output_tokens * price.output_per_token
        + usage.cache_read_tokens * price.cache_read_per_token
        + usage.cache_write_tokens * price.cache_write_per_token
    )
    db.insert("llm_usage", {
        "request_id": request_id,
        "model_id": model_id,
        "usage": usage.as_dict(),
        "price_snapshot": price.as_dict(),  # frozen copy, not a foreign key
        "cost_usd": cost,
    })
```

## How do we observe and debug an AI agent in production?

Every request produces a LangFuse trace: the prompt, each planning step, every tool call with arguments and results, token usage and latency. When a user reports a bad answer, we open the trace and see exactly which tool returned what and how the model used it.

Traces also feed our evaluation loop. Real questions that went wrong become regression cases, and each new agent version runs against that set before release. That loop is what made eight versions possible without regressions reaching users: every architectural change had to beat the previous version on the same questions.

## Want an agent like this in your product?

The patterns above apply well beyond trading analytics: any product where an agent must call real systems, handle real money or numbers, and stay within a budget. Read the full [case study of the AI research agent for an options analytics platform](/work/ai-options-analytics-platform/), or see how our [AI agent development services](/services/ai-agent-development/) take an agent from discovery sprint to production on Claude, AWS Bedrock and other providers.
