---
title: "What is an MCP server? A practical guide from building one with 105 tools"
description: "MCP explained by a team that shipped a 105-tool server: how the protocol works, how to name and group tools, and how to gate destructive actions safely."
pubDate: 2026-05-12
tags: ["MCP", "AI agents", "Tool calling", "Electron", "Claude"]
services: ["mcp-server-development", "ai-agent-development"]
caseStudy: "ai-desktop-trading-assistant"
---

An MCP server is a program that exposes capabilities, mainly tools, through the Model Context Protocol so that any MCP-compatible AI client can discover and call them. Each tool has a name, a description and a JSON Schema for its inputs, which the model reads to decide what to call and with which arguments. We shipped an MCP server with 105 tools in 17 groups that lets an AI agent read and operate live TradingView charts, and this guide covers what we learned doing it.

## Key takeaways

- **MCP standardizes the integration, not the intelligence.** It defines how a client discovers and calls your tools. The quality of the agent still depends on how well those tools are designed.
- **Group tools by domain and name them predictably.** With 105 tools, a consistent naming scheme and tight descriptions matter more than clever prompt wording.
- **Return compact, structured results.** The model reads every byte you return. Smaller results mean faster, cheaper and more accurate turns.
- **Route every destructive action through one approval gateway.** One code path, one user prompt, one audit trail.
- **Ship it like real software.** Our client is a signed, notarized Electron app with auto-update, because an agent that controls a user's workspace has to be trustworthy end to end.

## What is the Model Context Protocol?

The Model Context Protocol (MCP) is an open standard, introduced by Anthropic in late 2024, for connecting AI applications to external tools and data. Before MCP, every assistant needed a custom integration for every system it touched. MCP replaces that with one contract: build a server once, and any compatible client, such as Claude Desktop, Claude Code or your own agent, can use it.

The protocol has three roles:

- **Host:** the application the user interacts with, such as a desktop app or IDE.
- **Client:** the connector inside the host that maintains a session with one server.
- **Server:** the program that exposes capabilities.

Messages are JSON-RPC 2.0. A server can run locally over standard input and output, or remotely over HTTP. It can expose three kinds of primitives: **tools** (functions the model can call), **resources** (data the application can read into context) and **prompts** (reusable templates). In practice, tools carry most of the value for agents.

A client asks the server for its tools with `tools/list` and invokes one with `tools/call`. A tool definition looks like this:

```json
{
  "name": "chart_set_symbol",
  "description": "Switch the active chart to a different symbol. Use the exchange-qualified ticker when known.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "symbol": { "type": "string", "description": "Ticker, for example AAPL or NASDAQ:AAPL" }
    },
    "required": ["symbol"]
  }
}
```

The model never sees your implementation. It sees the name, the description and the schema. That is why tool design matters so much.

## What does an MCP server with 105 tools actually do?

Our client was a cross-platform desktop assistant for traders. The goal: a trader asks for an analysis, and it happens on their live chart. The agent reads indicator values, switches symbols, draws support and resistance levels and creates price alerts, all on TradingView charts the user already works with.

The MCP server reaches the chart through the **Chrome DevTools Protocol (CDP)**, the same low-level protocol browser developer tools use to inspect and drive a page. Each MCP tool translates a high-level intent, like "draw a horizontal level at this price", into the CDP calls needed to perform it and read back the result.

The 105 tools are organized into 17 groups by domain: symbol and chart navigation, indicator reading, drawing, alerts and so on. The grouping is not cosmetic. It shapes names, descriptions and which tools the agent loop offers for a given task.

## How should you name and group MCP tools?

When a model chooses from 105 tools, ambiguity is the main source of errors. These rules made the biggest difference for us.

**Use a consistent naming scheme.** A pattern that works well is a group prefix followed by a verb and an object, for example `chart_set_symbol`, `indicator_read_values`, `drawing_add_horizontal_line` or `alert_create_price`. The model picks up the pattern quickly, and humans reading traces can tell what happened at a glance.

**Write descriptions for the model, not for humans.** State when to use the tool, when not to, and what it returns. If two tools are easily confused, say so in both descriptions and point to the right one.

**Prefer specific tools over one tool with a mode flag.** A single `drawing` tool with a `type` enum and a dozen optional fields is harder for a model to fill correctly than a few focused tools with small schemas.

**Keep input schemas tight.** Use enums, required fields and clear units. Every optional field is an opportunity for the model to guess.

**Return less.** Return the values the model needs, in a stable structure, with units. Do not return entire DOM fragments or raw protocol payloads.

**Make reads cheap and writes explicit.** Reading state should be safe to call often. Anything that changes the user's workspace belongs in a clearly named write tool that passes through approval.

## How do you build the agent loop on top of an MCP server?

The MCP server provides tools; an agent loop decides when to call them. We built ours inside the Electron app with **native tool calling for three providers: Anthropic, AWS Bedrock and Gemini**. Each provider has its own request and response format for tool use, so the loop translates MCP tool definitions into the provider's format and translates tool calls back into MCP `tools/call` requests.

```ts
// Illustrative: one loop, provider adapters at the edges.
async function runTurn(messages: Message[], provider: ProviderAdapter, signal: AbortSignal) {
  const tools = provider.toTools(await mcp.listTools());
  while (!signal.aborted) {
    const reply = await provider.stream(messages, tools, { signal, onToken: ui.appendToken });
    messages.push(reply.message);
    if (reply.toolCalls.length === 0) return reply;

    for (const call of reply.toolCalls) {
      const result = await gateway.execute(call, signal); // approval lives here
      messages.push(provider.toolResult(call.id, result));
    }
  }
}
```

Three capabilities made the loop feel like a product rather than a prototype:

- **Token streaming.** Text streams into the UI as it is generated, and tool activity is shown as it happens.
- **Prompt caching.** The system prompt and tool catalog are large and stable. With 105 tools, the definitions alone are a significant prefix, so caching it reduces both latency and cost on every turn where the provider supports caching.
- **Cancellation.** The user can stop a turn at any point. One abort signal flows through the model request and every in-flight tool call, so a canceled turn stops cleanly instead of finishing work the user no longer wants.

## How do you stop an AI agent from doing something destructive?

Some tools change the user's workspace: removing drawings, deleting alerts, modifying chart layouts. We did not want approval logic scattered across 105 tool handlers, where one missed check becomes a bug.

Instead, every tool call passes through **a single approval gateway**. Each tool declares whether it is destructive. Read-only calls pass straight through. Destructive calls pause the turn and show the user exactly what the agent wants to do, with the arguments, and only proceed on explicit approval. Because there is one gateway, there is one place to test, one place to log and one place to tighten policy.

This pattern generalizes to any MCP server that writes data, sends messages or spends money. The model can propose anything; the gateway decides what runs.

## Why ship an MCP client as a signed desktop app?

An agent that controls part of a user's machine needs the same trust signals as any other desktop software. We ship **signed and notarized builds for macOS and Windows** so the operating system recognizes the publisher, and **in-app auto-update** so fixes and new tools reach every user without manual reinstalls. When the tool catalog evolves, auto-update keeps the agent loop and the MCP server in sync.

## When does your product need an MCP server?

Build one when you want AI assistants, your own or your customers', to use your product through a standard interface. Good signals:

- Customers ask to use your product from Claude or other AI tools.
- You are building an in-app agent and want a clean boundary between the agent and your system.
- You want one integration to serve several models and clients.

If you are planning one, see our [MCP server development services](/services/mcp-server-development/) for how we design tool catalogs, safety layers and agent clients, and read the [case study of the AI desktop assistant that operates live trading charts](/work/ai-desktop-trading-assistant/) for the full build behind the 105-tool server.
