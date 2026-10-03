// Single source of truth for company content, metadata and structured data.
// Rule: company voice only. Never include an individual's name or personal contact details.

export const company = {
  name: "ZeroTwo Solutions",
  legalName: "ZeroTwo Solutions",
  shortName: "ZeroTwo",
  url: "https://www.zerotwosolutions.com",
  email: "info@zerotwosolutions.com",
  tagline: "We turn AI ideas into revenue-generating products.",
  description:
    "ZeroTwo Solutions is an AI and FinTech software development company. We design, build and run production AI agents, MCP servers, real-time market data platforms and enterprise SaaS on AWS for startups and scale-ups in the US and worldwide.",
  github: "https://github.com/zerotwo-solutions",
  foundingYear: "2020",
  // Commitments shown on the site. Edit here if your engagement terms change.
  responseTime: "1 business day",
  roadmapTime: "48 hours",
  overlap: "4+ hours of daily overlap with US Eastern and Pacific time",
};

export const nav = [
  { label: "Services", href: "/services/" },
  { label: "Work", href: "/work/" },
  { label: "Process", href: "/process/" },
  { label: "About", href: "/about/" },
  { label: "Blog", href: "/blogs/" },
];

/** Verifiable proof points from shipped production work. */
export const stats = [
  { value: 105, suffix: "", label: "MCP tools behind one desktop AI agent" },
  { value: 1500, suffix: "+", label: "automated tests on a voice AI product" },
  { value: 130, suffix: "+", label: "live analytics pages in production" },
  { value: 10, suffix: "M+", label: "Redis keys served in a hardened cluster" },
];

export const proofStrip = [
  "Claude & AWS Bedrock agents",
  "MCP servers",
  "US options (OPRA) data",
  "Real-time WebSockets",
  "Stripe billing",
  "Signed desktop apps",
  "Voice AI",
  "AWS & Kubernetes",
];

export type Service = {
  slug: string;
  title: string;
  short: string;
  /** H1 on the service page, written for search intent */
  h1: string;
  metaTitle: string;
  metaDescription: string;
  icon: "agent" | "mcp" | "chart" | "cloud" | "voice" | "bolt";
  /** Answer-first paragraph (quotable by AI search engines) */
  answer: string;
  outcomes: string[];
  deliverables: { title: string; body: string }[];
  stack: string[];
  relatedWork: string[];
  faq: { q: string; a: string }[];
};

export const services: Service[] = [
  {
    slug: "ai-agent-development",
    title: "AI Agent Development",
    short: "Production LLM agents on Claude, AWS Bedrock, OpenAI and Gemini, with tools, guardrails, tracing and cost control.",
    h1: "AI agent development for products that ship",
    metaTitle: "AI Agent Development Company | Claude, Bedrock & LangGraph",
    metaDescription:
      "We build production AI agents on Claude, AWS Bedrock, OpenAI and Gemini: tool calling, RAG, guardrails, LangFuse tracing and per-request cost metering. Get a technical roadmap in 48 hours.",
    icon: "agent",
    answer:
      "ZeroTwo Solutions builds AI agents that run in production, not demos. We design the agent loop, tool layer, memory and guardrails, then ship with streaming, tracing, evaluation and per-request cost metering. Our agents run on Anthropic Claude, AWS Bedrock, OpenAI and Gemini using LangGraph, DeepAgents and native tool calling.",
    outcomes: [
      "Agents that call your real systems through typed, permission-checked tools",
      "Guardrails: server-side argument limits, prompt-leak detection and human approval for destructive actions",
      "Observability with LangFuse traces, evaluation sets and cost per request",
      "Streaming responses over WebSockets with prompt caching to cut latency and spend",
    ],
    deliverables: [
      { title: "Agent architecture", body: "Single deep agent or multi-agent design chosen from evidence, with context summarization and Postgres-backed state." },
      { title: "Tool layer", body: "Typed tools wrapping your APIs and data, with validation and rate limits enforced on the server, never in the prompt." },
      { title: "Deterministic math", body: "A scoring and calculation engine outside the model so numbers your users see are never hallucinated." },
      { title: "LLMOps", body: "Tracing, regression evals, prompt versioning, cost dashboards and model fallbacks across providers." },
    ],
    stack: ["Anthropic Claude", "AWS Bedrock", "OpenAI", "Gemini", "LangGraph", "DeepAgents", "LangChain", "LangFuse", "RAG", "Python", "Django", "FastAPI"],
    relatedWork: ["ai-options-analytics-platform", "voice-ai-trading-assistant"],
    faq: [
      {
        q: "How long does it take to build a production AI agent?",
        a: "A focused agent with 5 to 15 tools typically reaches a production pilot in 4 to 8 weeks. We start with a 1 to 2 week discovery sprint that produces the architecture, tool list, evaluation set and a working prototype on your data.",
      },
      {
        q: "Which LLM should we use: Claude, GPT or Gemini?",
        a: "We choose per workload using your own evaluation set. We often run Claude through AWS Bedrock for reasoning-heavy agents inside an AWS account, and keep the agent loop provider-independent so you can switch or fall back without a rewrite.",
      },
      {
        q: "How do you stop an AI agent from hallucinating numbers?",
        a: "Calculations live in deterministic code that the agent calls as a tool, so the model explains results instead of computing them. We add server-side tool argument limits, output validation and regression evaluations on every release.",
      },
    ],
  },
  {
    slug: "mcp-server-development",
    title: "MCP Server Development",
    short: "Model Context Protocol servers that let Claude and other agents safely read and act on your product.",
    h1: "MCP server development: connect AI agents to your product",
    metaTitle: "MCP Server Development | Model Context Protocol Experts",
    metaDescription:
      "We design and build Model Context Protocol (MCP) servers with typed tools, approval gates and auth so Claude and other AI agents can safely use your product. 105-tool MCP server shipped.",
    icon: "mcp",
    answer:
      "An MCP (Model Context Protocol) server exposes your product's capabilities as typed tools that AI assistants like Claude can discover and call. ZeroTwo Solutions builds MCP servers with grouped tools, input validation, authentication and a single approval gateway for destructive actions. We shipped a 105-tool MCP server that lets an AI agent operate live trading charts.",
    outcomes: [
      "Your product becomes usable from Claude Desktop, Claude Code and any MCP-compatible agent",
      "Tool design grouped by domain so models pick the right tool on the first try",
      "Destructive actions routed through one approval gateway the user controls",
      "Versioned, tested tool contracts that survive model upgrades",
    ],
    deliverables: [
      { title: "Tool design", body: "We map your API into well-named, well-described tool groups with schemas models understand." },
      { title: "Server build", body: "Production MCP server with auth, rate limits, logging and transport suited to desktop or remote use." },
      { title: "Safety layer", body: "Approval prompts, scopes and audit logs for anything that writes, deletes or spends money." },
      { title: "Agent client", body: "Optional in-app agent loop with streaming, prompt caching and cancellation built on your MCP server." },
    ],
    stack: ["MCP", "TypeScript", "Python", "Anthropic SDK", "AWS Bedrock", "Gemini", "Electron", "Chrome DevTools Protocol"],
    relatedWork: ["ai-desktop-trading-assistant", "ai-options-analytics-platform"],
    faq: [
      {
        q: "What is an MCP server?",
        a: "MCP (Model Context Protocol) is an open standard for connecting AI assistants to tools and data. An MCP server publishes tools with names, descriptions and input schemas that a model can call, so the same integration works across Claude and other MCP-compatible clients.",
      },
      {
        q: "Is it safe to let an AI agent act inside our product?",
        a: "Yes, when the server enforces it. We validate every tool input on the server, scope credentials to least privilege and route destructive actions through an explicit user approval step with an audit log.",
      },
      {
        q: "How many tools should an MCP server have?",
        a: "As many as the job needs, organized into clear groups. Our largest server exposes 105 tools in 17 groups; good naming and descriptions matter more than count for reliable tool selection.",
      },
    ],
  },
  {
    slug: "fintech-software-development",
    title: "FinTech & Market Data",
    short: "Trading analytics, options flow, dark pool feeds and real-time market data infrastructure built for bursts.",
    h1: "FinTech software development for real-time markets",
    metaTitle: "FinTech Software Development Company | Real-Time Market Data",
    metaDescription:
      "FinTech software development for trading and analytics products: OPRA options feeds, dark pool data, Redis Streams pipelines, WebSocket fan-out and Stripe subscriptions. Built for US markets.",
    icon: "chart",
    answer:
      "ZeroTwo Solutions builds FinTech platforms that process live market data without dropping messages. We have shipped pipelines that ingest the US options (OPRA) firehose and dark pool trades into Redis Streams, analytics platforms with 130+ live pages over 100+ WebSocket routes, and subscription billing on Stripe.",
    outcomes: [
      "Ingestion that survives traffic bursts with bounded queues and batched writes",
      "Self-healing feeds that detect stalls and restart automatically",
      "Sub-second updates to thousands of concurrent users over WebSockets",
      "Subscription tiers, metering and billing on Stripe",
    ],
    deliverables: [
      { title: "Market data pipelines", body: "Vendor feed ingestion, normalization, aggregation and storage with alerting on dropped messages." },
      { title: "Analytics platforms", body: "Options flow, dark pool and volatility dashboards with live charts and screeners." },
      { title: "Trading tools", body: "TradingView integrations, alerts, desktop trading assistants and AI research agents." },
      { title: "Billing & access", body: "Tiered subscriptions, entitlements and usage metering with Stripe." },
    ],
    stack: ["Python", "Django", "Django Channels", "Redis Streams", "RediSearch", "PostgreSQL", "WebSockets", "Celery", "Stripe", "AWS"],
    relatedWork: ["real-time-options-flow-pipeline", "ai-options-analytics-platform"],
    faq: [
      {
        q: "Can you work with OPRA and US options market data?",
        a: "Yes. We have built production pipelines that ingest a vendor's OPRA options feed and dark pool trades, classify trade sentiment, aggregate in 60-second windows across parallel jobs and stream results to live dashboards.",
      },
      {
        q: "How do you handle traffic bursts at market open?",
        a: "Bounded in-memory queues, a connection pool per stream, pipelined batch writes of thousands of messages, burst detection on 200 ms buckets and alerts on any dropped message. Stalled feeds restart automatically within minutes.",
      },
      {
        q: "Do you build trading execution systems?",
        a: "Our core strength is analytics, market data infrastructure and AI tooling for traders. For execution-adjacent work we scope compliance and broker integration requirements together with your team before committing.",
      },
    ],
  },
  {
    slug: "saas-development",
    title: "SaaS & Cloud Engineering",
    short: "Enterprise SaaS on AWS and Kubernetes: multi-tenant, secure, observable and ready to scale.",
    h1: "SaaS development on AWS, built to scale from day one",
    metaTitle: "SaaS Development Company | AWS, Django, React & Kubernetes",
    metaDescription:
      "Full-stack SaaS development on AWS: Django, FastAPI, React, Next.js, PostgreSQL, Docker and Kubernetes with CI/CD, monitoring and security baked in. MVP to enterprise scale.",
    icon: "cloud",
    answer:
      "ZeroTwo Solutions builds SaaS products end to end: Python and Django or FastAPI backends, React and Next.js frontends, PostgreSQL and Redis, deployed on AWS with Docker, Kubernetes, CI/CD and monitoring. We take products from MVP to scale and harden existing platforms for performance and reliability.",
    outcomes: [
      "An MVP in front of users in weeks, on architecture that does not need a rewrite",
      "Infrastructure as code, CI/CD and environments your team can own",
      "Security baseline: JWT, MFA, rate limiting, least-privilege IAM",
      "Performance tuning across Nginx, Gunicorn, Postgres and Redis",
    ],
    deliverables: [
      { title: "Product engineering", body: "Backend, frontend, admin and APIs delivered in weekly increments you can click through." },
      { title: "Cloud & DevOps", body: "AWS (EC2, ECS, Lambda, RDS, S3, CloudFront), Docker, Kubernetes and GitHub Actions pipelines." },
      { title: "Desktop & mobile", body: "Electron apps with signed, notarized builds and auto-update; React Native and PWAs." },
      { title: "Rescue & scale", body: "Audits and fixes for slow, unstable or expensive production systems." },
    ],
    stack: ["Python", "Django", "FastAPI", "Node.js", "React", "Next.js", "TypeScript", "PostgreSQL", "Redis", "AWS", "Docker", "Kubernetes"],
    relatedWork: ["ai-options-analytics-platform", "ai-desktop-trading-assistant"],
    faq: [
      {
        q: "How much does it cost to build a SaaS MVP?",
        a: "It depends on scope, integrations and compliance needs. After a short discovery call we send a fixed-scope proposal with milestones and a price, usually within 48 hours, so you know the cost before any work starts.",
      },
      {
        q: "Do we own the code and IP?",
        a: "Yes. You own 100% of the code, infrastructure and intellectual property from the first commit. Work happens in your repositories and cloud accounts, under an NDA signed before kickoff.",
      },
      {
        q: "Can you take over an existing codebase?",
        a: "Yes. We start with a paid technical audit covering architecture, security, performance and test coverage, then propose a prioritized plan. Much of our work is hardening and scaling systems that are already live.",
      },
    ],
  },
  {
    slug: "voice-ai-development",
    title: "Voice AI Development",
    short: "Real-time voice assistants with live transcripts, concurrent tool calls, metering and spend caps.",
    h1: "Voice AI development for real-time assistants",
    metaTitle: "Voice AI Development | Real-Time Voice Agents with Tools",
    metaDescription:
      "We build real-time voice AI assistants with Gemini Live and ElevenLabs: live transcripts, concurrent tool calls, usage metering and spend caps, covered by 1,500+ automated tests.",
    icon: "voice",
    answer:
      "ZeroTwo Solutions builds real-time voice AI assistants that talk, listen and take action. We put voice engines like Gemini Live and ElevenLabs behind one provider-independent interface, run a turn's tool calls concurrently to keep replies fast, and meter usage with spend caps and prepaid credits.",
    outcomes: [
      "Low-latency spoken replies with live on-screen transcript",
      "Provider-independent voice layer so you can switch engines",
      "Dozens of tools callable mid-conversation, executed concurrently",
      "Usage metering, weekly and monthly spend caps and prepaid credits",
    ],
    deliverables: [
      { title: "Realtime transport", body: "WebSocket audio streaming on Django Channels with session state and reconnection." },
      { title: "Voice engines", body: "Gemini Live native audio and ElevenLabs behind one interface, selectable per user or plan." },
      { title: "Tooling", body: "Domain tools executed concurrently with asyncio so the assistant answers while it works." },
      { title: "Production hardening", body: "JWT, MFA, rate limiting, Docker deployment and a large automated test suite." },
    ],
    stack: ["Gemini Live API", "ElevenLabs", "Django Channels", "asyncio", "Celery", "PostgreSQL", "Redis", "Docker", "Pytest"],
    relatedWork: ["voice-ai-trading-assistant"],
    faq: [
      {
        q: "Which voice AI engines do you work with?",
        a: "We have shipped Gemini Live native audio and ElevenLabs in production behind a single interface, and integrate OpenAI realtime models where they fit. The transport layer stays independent of the provider.",
      },
      {
        q: "How do you control voice AI costs?",
        a: "Every session is metered. Users get weekly and monthly spend caps and prepaid credits, and the system enforces limits server-side before a model call is made.",
      },
    ],
  },
];

export type CaseStudy = {
  slug: string;
  title: string;
  client: string;
  industry: string;
  summary: string;
  metaDescription: string;
  challenge: string;
  solution: string[];
  results: { value: string; label: string }[];
  flow: string[];
  stack: string[];
  services: string[];
  accent: string;
  visual: "agent" | "flow" | "mcp" | "voice";
};

export const caseStudies: CaseStudy[] = [
  {
    slug: "ai-options-analytics-platform",
    title: "AI research agent for an options analytics platform",
    client: "Options analytics company",
    industry: "FinTech · Trading analytics",
    summary:
      "A subscription analytics platform with 130+ live pages for options flow, dark pool and volatility data, plus an AI research agent on Claude via AWS Bedrock.",
    metaDescription:
      "Case study: an options analytics SaaS with 130+ live pages over 100+ WebSocket routes and an AI research agent on Claude via AWS Bedrock with 16 tools and LangFuse tracing.",
    challenge:
      "Traders needed answers about live options flow faster than they could click through dashboards, and the business needed an AI feature it could trust with numbers and afford at scale.",
    solution: [
      "Core engineering on a four-tier subscription platform with 130+ analytics pages updated live over 100+ WebSocket routes.",
      "AI research agent taken through eight versions, from semantic routing to multi-agent to a single deep agent on Claude via AWS Bedrock, with 16 tools and Postgres-backed conversation state.",
      "Guardrails: server-side tool argument limits, prompt-leak detection, automatic context summarization and a deterministic scoring engine so the model never calculates figures itself.",
      "Per-request LLM cost metering with price snapshots, prompt caching, a page-level chart analysis assistant and Stripe subscription billing.",
    ],
    results: [
      { value: "130+", label: "live analytics pages" },
      { value: "100+", label: "WebSocket routes" },
      { value: "16", label: "agent tools" },
      { value: "8", label: "agent versions shipped" },
    ],
    flow: ["Browser", "WebSocket gateway", "Deep agent · Claude on Bedrock", "16 tools", "Postgres state", "LangFuse traces"],
    stack: ["Django", "DRF", "Django Channels", "Celery", "PostgreSQL", "Redis", "AWS Bedrock", "LangGraph", "DeepAgents", "LangFuse", "Stripe"],
    services: ["ai-agent-development", "fintech-software-development", "saas-development"],
    accent: "#8b7cff",
    visual: "agent",
  },
  {
    slug: "real-time-options-flow-pipeline",
    title: "Real-time options flow and dark pool pipeline",
    client: "Options analytics company",
    industry: "FinTech · Market data",
    summary:
      "A market data pipeline that ingests the US options (OPRA) firehose and dark pool trades without dropping messages during market-open bursts.",
    metaDescription:
      "Case study: an OPRA options and dark pool pipeline on Redis Streams with a 50,000-item bounded queue, 5,000-message batch writes, 200 ms burst detection and self-healing feeds.",
    challenge:
      "Market open produces violent traffic bursts. The previous approach dropped messages and stalled silently, so dashboards showed stale or incomplete flow at the moments traders cared about most.",
    solution: [
      "Stream writer with a bounded 50,000-item queue, a connection pool per stream, pipelined batch writes of 5,000 messages and alerts on any dropped message.",
      "60-second aggregation across 8 parallel jobs feeding live dashboards over WebSockets.",
      "Two-tier trade sentiment (bid/ask spread first, tick rule as fallback), a correction pass five minutes after each trade and atomic alert cooldowns.",
      "Burst detection on 200 ms buckets and self-healing that restarts a stalled feed within three minutes.",
    ],
    results: [
      { value: "50k", label: "item bounded queue" },
      { value: "5,000", label: "messages per batch write" },
      { value: "200 ms", label: "burst detection buckets" },
      { value: "< 3 min", label: "automatic feed recovery" },
    ],
    flow: ["OPRA firehose", "Bounded queue · 50k", "Redis Streams", "60s aggregation × 8", "WebSocket fan-out", "Analytics UI"],
    stack: ["Python", "Redis Streams", "RediSearch", "WebSockets", "Multithreading", "AWS S3", "PM2"],
    services: ["fintech-software-development"],
    accent: "#4fd1c5",
    visual: "flow",
  },
  {
    slug: "ai-desktop-trading-assistant",
    title: "AI desktop assistant that operates live trading charts",
    client: "Options analytics company",
    industry: "FinTech · Desktop AI",
    summary:
      "A cross-platform Electron app where an AI agent reads and controls live TradingView charts through a 105-tool MCP server.",
    metaDescription:
      "Case study: a cross-platform Electron AI assistant with a 105-tool MCP server over the Chrome DevTools Protocol, multi-provider tool calling and signed macOS and Windows builds.",
    challenge:
      "Traders wanted to ask for an analysis and have it happen on their chart: read indicators, switch symbols, draw levels and set alerts, without giving an AI uncontrolled access to their workspace.",
    solution: [
      "Agent loop with native tool calling for Anthropic, AWS Bedrock and Gemini, with token streaming, prompt caching and request cancellation.",
      "MCP server exposing 105 tools in 17 groups over the Chrome DevTools Protocol to read indicators, switch symbols, draw levels and create alerts.",
      "User approval for destructive actions enforced at a single gateway.",
      "Signed, notarized builds for macOS and Windows with in-app auto-update.",
    ],
    results: [
      { value: "105", label: "MCP tools" },
      { value: "17", label: "tool groups" },
      { value: "3", label: "LLM providers" },
      { value: "2", label: "signed desktop platforms" },
    ],
    flow: ["User prompt", "Agent loop · Claude / Bedrock / Gemini", "Approval gateway", "MCP server · 105 tools", "Chrome DevTools Protocol", "Live chart"],
    stack: ["Electron", "React", "TypeScript", "Tailwind CSS", "Anthropic SDK", "AWS Bedrock", "Gemini", "MCP"],
    services: ["mcp-server-development", "ai-agent-development"],
    accent: "#f5a524",
    visual: "mcp",
  },
  {
    slug: "voice-ai-trading-assistant",
    title: "Real-time voice AI assistant with 56 tools",
    client: "Options analytics company",
    industry: "FinTech · Voice AI",
    summary:
      "A browser-based voice assistant with a live transcript, two voice engines behind one interface and metered usage billing, covered by 1,500+ automated tests.",
    metaDescription:
      "Case study: a real-time voice AI assistant on Django Channels with Gemini Live and ElevenLabs, 56 concurrent tools, spend caps and 1,500+ automated tests.",
    challenge:
      "Voice assistants feel broken when they pause to think. The product needed fast spoken answers that pull live market data, with costs that could never run away.",
    solution: [
      "Gemini Live native audio and ElevenLabs engines behind one interface, so the WebSocket layer is provider-independent.",
      "56 tools exposed to the model, with a turn's tool calls run concurrently via asyncio to keep spoken replies fast.",
      "Usage metering with weekly and monthly spend caps and prepaid credits.",
      "Docker Compose deployment behind Nginx with rate limiting, JWT authentication and MFA, covered by more than 1,500 automated tests.",
    ],
    results: [
      { value: "56", label: "voice-callable tools" },
      { value: "1,500+", label: "automated tests" },
      { value: "2", label: "voice engines, one interface" },
      { value: "0", label: "unbounded spend paths" },
    ],
    flow: ["Microphone", "Django Channels", "Gemini Live / ElevenLabs", "56 tools via asyncio", "Metering & spend caps", "Spoken reply"],
    stack: ["Python", "Django Channels", "Celery", "PostgreSQL", "Redis", "Gemini Live", "ElevenLabs", "Docker", "Pytest"],
    services: ["voice-ai-development", "ai-agent-development"],
    accent: "#3ddc97",
    visual: "voice",
  },
];

export const moreWork = [
  { title: "Real-time stock market application", body: "React, TypeScript and Django platform consuming a global exchange WebSocket feed and streaming updates to thousands of concurrent clients, with role-based access control." },
  { title: "AI image generation system", body: "FastAPI service running fine-tuned LoRA models on Stable Diffusion with scalable GPU inference on AWS." },
  { title: "Social media platform", body: "React Native and progressive web apps for media, chat, shopping and Q&A, migrated to a serverless AWS backend (AppSync, Lambda, DynamoDB)." },
  { title: "SDLC management platform", body: "NX monorepo frontend in React and Material UI with Django REST Framework APIs on AWS." },
  { title: "Encrypted real-time chat", body: "Django Channels chat with presence, read receipts and RSA end-to-end encryption." },
  { title: "High-performance marketing site", body: "Static export with lazy-loaded 3D scenes, JSON-LD structured data and build checks for bundle size, SEO rules and WCAG AA contrast." },
];

export const stack = [
  { group: "AI & LLM", items: ["Claude", "AWS Bedrock", "OpenAI", "Gemini", "LangGraph", "LangChain", "DeepAgents", "LangFuse", "MCP", "RAG", "ElevenLabs", "Hugging Face", "Stable Diffusion"] },
  { group: "Backend", items: ["Python", "Django", "DRF", "Django Channels", "FastAPI", "Node.js", "Celery", "WebSockets"] },
  { group: "Frontend & desktop", items: ["React", "Next.js", "TypeScript", "Electron", "React Native", "Tailwind CSS", "Three.js"] },
  { group: "Data", items: ["PostgreSQL", "Redis Streams", "RediSearch", "MySQL", "DynamoDB"] },
  { group: "Cloud & DevOps", items: ["AWS", "Docker", "Kubernetes", "Nginx", "GitHub Actions", "Grafana", "CloudFormation"] },
];

export const process = [
  { step: "01", title: "Discovery call", time: "30 min", body: "We learn the business goal, constraints and what success looks like. NDA available before we talk details." },
  { step: "02", title: "Technical roadmap", time: "48 hours", body: "You receive architecture, milestones, risks and a fixed-scope proposal. No obligation." },
  { step: "03", title: "Pilot sprint", time: "1–2 weeks", body: "A working slice on your data and infrastructure, so you judge us on shipped software, not slides." },
  { step: "04", title: "Build & ship", time: "Weekly demos", body: "Weekly demos, written updates and staging you can click. Production releases behind CI/CD and tests." },
  { step: "05", title: "Run & scale", time: "Ongoing", body: "Monitoring, cost tuning and new features as a long-term engineering partner." },
];

export const guarantees = [
  { title: "You own 100% of the IP", body: "Code lives in your repositories and cloud accounts from the first commit." },
  { title: "NDA before kickoff", body: "Mutual NDA on request before you share anything sensitive." },
  { title: "US business-hours overlap", body: "Daily overlap with Eastern and Pacific time for calls, reviews and incident response." },
  { title: "Weekly demos", body: "Working software every week, not status reports. Cancel any time with no lock-in." },
  { title: "Senior engineers only", body: "The people on the discovery call are the people writing your code." },
  { title: "Security by default", body: "Least-privilege IAM, secrets management, MFA and audit logs as standard practice." },
];

export const engagementModels = [
  { title: "Fixed-scope pilot", body: "A 1–2 week sprint with a fixed price that delivers a working slice. The lowest-risk way to start.", best: "Validating an AI idea" },
  { title: "Product build", body: "Milestone-based delivery of an MVP or new product line with a dedicated senior team.", best: "New products and MVPs" },
  { title: "Engineering partner", body: "Monthly retainer for ongoing development, AI features and infrastructure.", best: "Scaling teams" },
];

export const homeFaq = [
  {
    q: "What does ZeroTwo Solutions do?",
    a: "ZeroTwo Solutions is a software development company specializing in production AI agents, MCP servers, real-time FinTech platforms and SaaS on AWS. We design, build and operate the software, from architecture to production.",
  },
  {
    q: "Do you work with US companies?",
    a: "Yes. We are a remote-first team built for US clients, with daily overlap with Eastern and Pacific business hours, US-English communication, NDAs and contracts that assign all IP to you.",
  },
  {
    q: "How quickly can you start?",
    a: "Most clients get a technical roadmap within 48 hours of the first call, and pilot sprints typically start within one to two weeks.",
  },
  {
    q: "What does a project cost?",
    a: "We quote fixed-scope pilots and milestone-based builds after a short discovery call, so you see the full price before work starts. There are no long-term contracts.",
  },
  {
    q: "What technologies do you use?",
    a: "Python, Django, FastAPI, React, Next.js and TypeScript on AWS, with Claude, AWS Bedrock, OpenAI, Gemini, LangGraph and MCP for AI work, and PostgreSQL and Redis Streams for data.",
  },
];

export const serviceBySlug = (slug: string) => services.find((s) => s.slug === slug);
export const caseBySlug = (slug: string) => caseStudies.find((c) => c.slug === slug);
