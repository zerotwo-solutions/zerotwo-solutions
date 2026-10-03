/**
 * "Plan your build" estimator. computePlan() is pure and shared by the server render
 * (sensible no-JS default) and the client, so both always agree. No prices, ever:
 * we quote fixed scope after a call. Every rule that moves the timeline is listed in
 * `rules` and shown to the visitor.
 */

export type ProjectType = "agent" | "mcp" | "fintech" | "saas" | "voice";
export type Feature = "rag" | "integrations" | "realtime" | "billing" | "app" | "compliance";
export type Stage = "idea" | "prototype" | "production";

export interface PlanInput {
  type: ProjectType;
  features: Feature[];
  stage: Stage;
}

export interface EngagementModel {
  title: string;
  body: string;
  best: string;
}

export interface Phase {
  key: "discovery" | "pilot" | "build" | "hardening";
  label: string;
  min: number;
  max: number;
  /** Earliest start week (sum of previous minimums) */
  start: number;
  note: string;
}

export interface Plan {
  engagement: EngagementModel;
  phases: Phase[];
  total: [number, number];
  scale: number;
  team: string;
  stack: string[];
  rules: string[];
  summary: string;
  href: string;
}

export const TYPE_LABELS: Record<ProjectType, string> = {
  agent: "AI agent",
  mcp: "MCP server",
  fintech: "FinTech data platform",
  saas: "SaaS MVP",
  voice: "Voice AI",
};

export const FEATURE_LABELS: Record<Feature, string> = {
  rag: "RAG over documents",
  integrations: "Integrations with existing APIs",
  realtime: "Real-time data",
  billing: "Billing & subscriptions",
  app: "Mobile or desktop app",
  compliance: "Compliance / SSO",
};

export const STAGE_LABELS: Record<Stage, string> = {
  idea: "Idea",
  prototype: "Prototype",
  production: "In production",
};

export const DEFAULT_INPUT: PlanInput = { type: "agent", features: ["integrations"], stage: "idea" };

type Range = [number, number];

const TYPES: Record<ProjectType, { build: Range; harden: Range; team: string; stack: string[] }> = {
  agent: {
    build: [2, 4],
    harden: [1, 2],
    team: "AI lead + 2 senior engineers",
    stack: ["Claude", "AWS Bedrock", "LangGraph", "LangFuse", "Python", "FastAPI"],
  },
  mcp: {
    build: [2, 3],
    harden: [1, 1],
    team: "AI lead + 1 senior engineer",
    stack: ["MCP", "TypeScript", "Python", "Anthropic SDK"],
  },
  fintech: {
    build: [5, 8],
    harden: [2, 3],
    team: "2 senior backend engineers + data infrastructure lead",
    stack: ["Python", "Django", "Redis Streams", "PostgreSQL", "WebSockets", "AWS"],
  },
  saas: {
    build: [5, 8],
    harden: [1, 2],
    team: "2 senior full-stack engineers + part-time DevOps engineer",
    stack: ["Django", "React", "Next.js", "PostgreSQL", "AWS", "Docker"],
  },
  voice: {
    build: [4, 6],
    harden: [2, 2],
    team: "AI lead + 2 senior engineers",
    stack: ["Gemini Live", "ElevenLabs", "Django Channels", "asyncio", "Redis"],
  },
};

const isAi = (t: ProjectType) => t === "agent" || t === "mcp" || t === "voice";

const fmtRange = ([a, b]: Range) => (a === b ? `${a}` : `${a}–${b}`);
const weeks = (r: Range) => `${fmtRange(r)} wk${r[1] === 1 ? "" : "s"}`;

export function computePlan(input: PlanInput, models: EngagementModel[]): Plan {
  const t = TYPES[input.type];
  const has = (f: Feature) => input.features.includes(f);
  const rules: string[] = [];
  const stack = [...t.stack];
  const teamExtras: string[] = [];

  const discovery: Range = input.stage === "prototype" ? [1, 1] : [1, 2];
  const pilot: Range = input.stage === "production" ? [1, 1] : [1, 2];
  const build: Range = [...t.build];
  const harden: Range = [...t.harden];
  rules.push(`${TYPE_LABELS[input.type]} baseline: build ${weeks(t.build)}, hardening ${weeks(t.harden)}`);

  const addBuild = (r: Range, why: string) => {
    build[0] += r[0];
    build[1] += r[1];
    rules.push(`+${weeks(r)} build · ${why}`);
  };

  if (has("rag")) {
    addBuild([1, 2], FEATURE_LABELS.rag);
    stack.push("RAG", "PostgreSQL");
  }
  if (has("integrations")) {
    addBuild([1, 2], FEATURE_LABELS.integrations);
    stack.push(isAi(input.type) ? "MCP" : "Celery");
  }
  if (has("realtime")) {
    if (input.type === "fintech") rules.push("Real-time data is already in the FinTech baseline");
    else addBuild([1, 2], FEATURE_LABELS.realtime);
    stack.push("WebSockets", "Redis Streams", "Django Channels");
  }
  if (has("billing")) {
    addBuild([1, 1], FEATURE_LABELS.billing);
    stack.push("Stripe");
  }
  if (has("app")) {
    addBuild([2, 3], FEATURE_LABELS.app);
    stack.push("Electron", "React Native");
    teamExtras.push("desktop & mobile engineer");
  }
  if (has("compliance")) {
    harden[0] += 1;
    harden[1] += 2;
    rules.push(`+1–2 wks hardening · ${FEATURE_LABELS.compliance}`);
    stack.push("AWS", "CloudFormation");
    teamExtras.push(input.type === "saas" ? "security review" : "part-time DevOps & security engineer");
  }

  if (input.stage === "prototype") {
    build[0] = Math.max(1, build[0] - 1);
    build[1] = Math.max(build[0], build[1] - 1);
    rules.push("−1 wk build · a working prototype already exists");
  }
  if (input.stage === "production") {
    harden[1] += 1;
    rules.push("+0–1 wk hardening · zero-downtime rollout on a live system");
  }
  if (build[1] >= 10) {
    build[0] = Math.max(2, build[0] - 1);
    build[1] -= 2;
    teamExtras.push("1 extra senior engineer");
    rules.push("−1–2 wks build · scope is large enough to add an engineer and parallelize");
  }

  const notes = {
    discovery:
      input.stage === "production"
        ? "Technical audit of the live system"
        : input.stage === "prototype"
          ? "Review your prototype, architecture and risks"
          : "Architecture, risks and a working prototype",
    pilot: input.stage === "production" ? "First fix or feature live in production" : "A working slice on your data",
    build: "Weekly demos and a staging environment you can click",
    hardening: "Tests, monitoring, security baseline and launch",
  };

  const raw: Omit<Phase, "start">[] = [
    { key: "discovery", label: "Discovery", min: discovery[0], max: discovery[1], note: notes.discovery },
    { key: "pilot", label: "Pilot", min: pilot[0], max: pilot[1], note: notes.pilot },
    { key: "build", label: "Build", min: build[0], max: build[1], note: notes.build },
    { key: "hardening", label: "Hardening", min: harden[0], max: harden[1], note: notes.hardening },
  ];
  let cursor = 0;
  const phases: Phase[] = raw.map((p) => {
    const phase = { ...p, start: cursor };
    cursor += p.min;
    return phase;
  });
  const total: Range = [phases.reduce((a, p) => a + p.min, 0), phases.reduce((a, p) => a + p.max, 0)];
  const scale = Math.max(...phases.map((p) => p.start + p.max));

  const modelTitle = input.stage === "idea" ? "Fixed-scope pilot" : input.stage === "prototype" ? "Product build" : "Engineering partner";
  const engagement = models.find((m) => m.title === modelTitle) ?? models[0] ?? { title: modelTitle, body: "", best: "" };

  const team = [t.team, ...teamExtras].join(" + ");
  const uniqueStack = Array.from(new Set(stack)).slice(0, 12);

  const featureText = input.features.length ? input.features.map((f) => FEATURE_LABELS[f]).join(", ") : "None selected";
  const summary = [
    `Project: ${TYPE_LABELS[input.type]}`,
    `Needs: ${featureText}`,
    `Stage: ${STAGE_LABELS[input.stage]}`,
    `Engagement: ${engagement.title}`,
    `Timeline: ${fmtRange(total)} weeks (${phases.map((p) => `${p.label} ${fmtRange([p.min, p.max])}`).join(", ")})`,
    `Team: ${team}`,
    `Stack: ${uniqueStack.join(", ")}`,
  ].join("; ");

  return {
    engagement,
    phases,
    total,
    scale,
    team,
    stack: uniqueStack,
    rules,
    summary,
    href: `/contact/?plan=${encodeURIComponent(summary)}`,
  };
}

export const formatWeeks = (min: number, max: number) => weeks([min, max]);

/* ---------------------------------------------------------------- client */

const FEATURES = Object.keys(FEATURE_LABELS) as Feature[];
const isType = (v: string): v is ProjectType => v in TYPE_LABELS;
const isStage = (v: string): v is Stage => v in STAGE_LABELS;
const isFeature = (v: string): v is Feature => (FEATURES as string[]).includes(v);

export function initEstimator(): void {
  const root = document.querySelector<HTMLElement>("[data-est]");
  const form = root?.querySelector<HTMLFormElement>("[data-est-form]");
  const dataEl = document.getElementById("estimator-data");
  if (!root || !form || !dataEl?.textContent) return;

  let models: EngagementModel[];
  try {
    models = JSON.parse(dataEl.textContent) as EngagementModel[];
  } catch {
    return;
  }

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const out = {
    engTitle: $("[data-o='eng-title']"),
    engBest: $("[data-o='eng-best']"),
    engBody: $("[data-o='eng-body']"),
    total: $("[data-o='total']"),
    team: $("[data-o='team']"),
    stack: $("[data-o='stack']"),
    rules: $("[data-o='rules']"),
    cta: $<HTMLAnchorElement>("[data-o='cta']"),
    live: $("[data-o='live']"),
  };
  const rows = new Map(
    Array.from(root.querySelectorAll<HTMLElement>("[data-phase]")).map((row) => [row.dataset.phase ?? "", row])
  );
  const axis = $("[data-o='axis']");

  const read = (): PlanInput => {
    const fd = new FormData(form);
    const type = String(fd.get("type") ?? "");
    const stage = String(fd.get("stage") ?? "");
    return {
      type: isType(type) ? type : DEFAULT_INPUT.type,
      stage: isStage(stage) ? stage : DEFAULT_INPUT.stage,
      features: fd.getAll("features").map(String).filter(isFeature),
    };
  };

  const list = (container: HTMLElement | null, items: string[], cls?: string) => {
    if (!container) return;
    container.replaceChildren(
      ...items.map((text) => {
        const li = document.createElement("li");
        if (cls) li.className = cls;
        li.textContent = text;
        return li;
      })
    );
  };

  let liveTimer = 0;
  const render = () => {
    const plan = computePlan(read(), models);
    if (out.engTitle) out.engTitle.textContent = plan.engagement.title;
    if (out.engBest) out.engBest.textContent = `Best for: ${plan.engagement.best}`;
    if (out.engBody) out.engBody.textContent = plan.engagement.body;
    if (out.total) out.total.textContent = `${fmtRange(plan.total)} weeks`;
    if (out.team) out.team.textContent = plan.team;
    list(out.stack, plan.stack, "tag");
    list(out.rules, plan.rules);
    if (out.cta) out.cta.href = plan.href;

    for (const p of plan.phases) {
      const row = rows.get(p.key);
      if (!row) continue;
      row.style.setProperty("--start", String(p.start / plan.scale));
      row.style.setProperty("--min", String(p.min / plan.scale));
      row.style.setProperty("--max", String(p.max / plan.scale));
      const label = row.querySelector<HTMLElement>("[data-weeks]");
      if (label) label.textContent = formatWeeks(p.min, p.max);
      const note = row.querySelector<HTMLElement>("[data-note]");
      if (note) note.textContent = p.note;
    }
    if (axis) {
      const ticks: string[] = [];
      const every = plan.scale > 16 ? 4 : 2;
      for (let w = 0; w <= plan.scale; w += every) ticks.push(`${w}`);
      axis.style.setProperty("--scale", String(plan.scale));
      axis.replaceChildren(
        ...ticks.map((w) => {
          const s = document.createElement("span");
          s.textContent = w === "0" ? "Week 0" : w;
          s.style.setProperty("--at", String(Number(w) / plan.scale));
          return s;
        })
      );
    }

    // Debounced, concise announcement for screen readers
    window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => {
      if (out.live) out.live.textContent = `Plan updated: ${plan.engagement.title}, ${fmtRange(plan.total)} weeks, ${plan.team}.`;
    }, 500);
  };

  form.addEventListener("change", render);
  form.addEventListener("submit", (e) => e.preventDefault());
  root.classList.add("is-ready");
  render();
}
