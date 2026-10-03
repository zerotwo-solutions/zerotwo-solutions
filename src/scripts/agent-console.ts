/**
 * Scripted "Talk to our agent" console. Deterministic: no network, no LLM.
 * Scenario content is built server-side from src/data/site.ts and embedded as JSON
 * (<script type="application/json" id="agent-data">), so answers only use facts from site data.
 */

export interface ToolStep {
  name: string;
  args: string;
  result: string;
}

export interface Scenario {
  id: string;
  /** Chip label + default prompt text. Omitted for scenarios reachable only by typing. */
  chip?: string;
  prompt: string;
  /** [term, weight] pairs used to route free-text questions. */
  keywords: [string, number][];
  tools: ToolStep[];
  thinking: { label: string; seconds: number };
  intro: string;
  flowTitle?: string;
  flow?: string[];
  timeline: [string, string][];
  proof?: string;
  cta: { label: string; href: string };
}

export interface AgentData {
  scenarios: Scenario[];
  fallback: Scenario;
}

/* -------------------------------------------------------------- routing */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function routeQuestion(text: string, data: AgentData): Scenario {
  const q = ` ${text.toLowerCase().replace(/[^a-z0-9+\-\s]/g, " ")} `;
  let best: Scenario | null = null;
  let bestScore = 0;
  for (const s of data.scenarios) {
    let score = 0;
    for (const [term, weight] of s.keywords) {
      const re = new RegExp(`(^|\\s)${escapeRe(term)}(s)?(?=\\s|$)`);
      if (re.test(q)) score += weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best && bestScore >= 2 ? best : data.fallback;
}

/* ------------------------------------------------------------ rendering */

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

class Cancelled extends Error {}

export function initAgentConsole(): void {
  const root = document.querySelector<HTMLElement>("[data-agent]");
  const dataEl = document.getElementById("agent-data");
  if (!root || !dataEl?.textContent) return;

  let data: AgentData;
  try {
    data = JSON.parse(dataEl.textContent) as AgentData;
  } catch {
    return;
  }

  const log = root.querySelector<HTMLElement>("[data-agent-log]");
  const scroller = root.querySelector<HTMLElement>("[data-agent-scroll]");
  const status = root.querySelector<HTMLElement>("[data-agent-status]");
  const form = root.querySelector<HTMLFormElement>("[data-agent-form]");
  const input = root.querySelector<HTMLInputElement>("[data-agent-input]");
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-scenario]"));
  if (!log || !scroller || !status || !form || !input) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let runId = 0;
  let stick = true;

  scroller.addEventListener(
    "scroll",
    () => {
      stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 24;
    },
    { passive: true }
  );

  const follow = () => {
    if (stick) scroller.scrollTop = scroller.scrollHeight;
  };

  const setStatus = (state: "ready" | "streaming" | "done") => {
    status.dataset.state = state;
    status.textContent = state === "streaming" ? "streaming" : state === "done" ? "done" : "ready";
  };

  const run = async (scenario: Scenario, promptText: string) => {
    const id = ++runId;
    const instant = motion.matches;
    const guard = () => {
      if (id !== runId) throw new Cancelled();
    };
    const wait = (ms: number) =>
      instant
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.setTimeout(resolve, ms)).then(guard);

    const stream = async (target: HTMLElement, text: string, speed = 1) => {
      if (instant) {
        target.textContent = text;
        return;
      }
      const tokens = text.match(/\S+\s*/g) ?? [text];
      let i = 0;
      while (i < tokens.length) {
        // 1–3 tokens per tick feels like real model streaming
        const n = 1 + Math.floor(Math.random() * 3);
        target.textContent += tokens.slice(i, i + n).join("");
        i += n;
        follow();
        await wait((14 + Math.random() * 26) / speed);
      }
    };

    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.scenario === scenario.id && promptText === scenario.prompt)));
    log.setAttribute("aria-busy", "true");
    log.replaceChildren();
    stick = true;
    scroller.scrollTop = 0;
    setStatus("streaming");

    try {
      // User turn
      const user = el("div", "a-user");
      user.append(el("span", "a-caret", ">"), el("span", "", promptText));
      log.append(user);
      await wait(260);

      // Tool calls
      for (const tool of scenario.tools) {
        const block = el("div", "a-tool is-running");
        const call = el("div", "a-call");
        call.append(el("span", "a-bullet"), el("span", "a-fn", tool.name), el("span", "a-args", `(${tool.args})`));
        block.append(call);
        log.append(block);
        follow();
        await wait(420 + Math.random() * 260);
        const result = el("div", "a-result");
        result.append(el("span", "a-elbow"), el("span", "", tool.result));
        block.append(result);
        block.classList.remove("is-running");
        follow();
        await wait(180);
      }

      // Thinking
      const think = el("div", "a-think is-running");
      const star = el("span", "a-star", "*");
      const label = el("span", "", `${scenario.thinking.label}…`);
      think.append(star, label);
      log.append(think);
      follow();
      await wait(scenario.thinking.seconds * 600);
      think.classList.remove("is-running");
      label.textContent = `Thought for ${scenario.thinking.seconds.toFixed(1)}s · ${scenario.thinking.label}`;

      // Answer
      const answer = el("div", "a-answer");
      log.append(answer);
      const intro = el("p", "a-intro");
      answer.append(intro);
      await stream(intro, scenario.intro);

      if (scenario.flow?.length) {
        await wait(140);
        answer.append(el("p", "a-label", scenario.flowTitle ?? "Suggested architecture"));
        const flow = el("ol", "a-flow");
        flow.setAttribute("role", "list");
        answer.append(flow);
        for (const node of scenario.flow) {
          flow.append(el("li", "", node));
          follow();
          await wait(110);
        }
      }

      if (scenario.timeline.length) {
        await wait(140);
        answer.append(el("p", "a-label", "Timeline"));
        const dl = el("dl", "a-timeline");
        answer.append(dl);
        for (const [k, v] of scenario.timeline) {
          const row = el("div", "a-row");
          row.append(el("dt", "", k), el("dd", "", v));
          dl.append(row);
          follow();
          await wait(150);
        }
      }

      if (scenario.proof) {
        await wait(120);
        const proof = el("p", "a-proof");
        answer.append(proof);
        await stream(proof, scenario.proof, 1.3);
      }

      await wait(160);
      const cta = el("a", "a-cta", scenario.cta.label);
      cta.href = scenario.cta.href;
      answer.append(cta);
      follow();
      setStatus("done");
    } catch (err) {
      if (!(err instanceof Cancelled)) throw err;
    } finally {
      if (id === runId) log.setAttribute("aria-busy", "false");
    }
  };

  const byId = new Map(data.scenarios.map((s) => [s.id, s]));
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      const s = byId.get(chip.dataset.scenario ?? "");
      if (s) void run(s, s.prompt);
    })
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, 200);
    if (!text) {
      input.focus();
      return;
    }
    const matched = routeQuestion(text, data);
    // The fallback echoes the question into its search tool call
    const scenario: Scenario =
      matched === data.fallback
        ? {
            ...matched,
            tools: matched.tools.map((t, i) =>
              i === 0 ? { ...t, args: `query="${text.slice(0, 48).replace(/"/g, "'")}${text.length > 48 ? "…" : ""}"` } : t
            ),
          }
        : matched;
    input.value = "";
    void run(scenario, text);
  });
}
