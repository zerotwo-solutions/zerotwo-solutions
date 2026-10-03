/**
 * "Real-time by default" demo: a simulated options-flow stream drawn on a hand-rolled
 * Canvas 2D chart (no chart library). The model mirrors the OPRA case study:
 * 200 ms buckets, a bounded 50,000-item queue, 5,000-message batch writes, zero drops.
 *
 * Pure helpers (PRNG, simulator, print generator) are exported so the .astro frontmatter
 * can server-render a deterministic snapshot for no-JS visitors and search engines.
 */

export const TICK_MS = 200;
export const QUEUE_CAP = 50_000;
export const BATCH = 5_000;
export const WINDOW = 150; // 30 s of 200 ms buckets

const BASE_PER_TICK = 6_000; // ≈ 30k events/s steady state
const DRAIN_BATCHES = 2; // pipelined 5,000-message writes per bucket
const DRAIN_BATCHES_HOT = 3; // extra writer once the queue passes 60% of its bound
const BURST_TICKS = 60;

/* ------------------------------------------------------------ utilities */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmtInt = new Intl.NumberFormat("en-US");
export const formatInt = (n: number) => fmtInt.format(Math.round(n));

/* ------------------------------------------------------------ simulator */

export interface Sample {
  price: number;
  rate: number; // events per second in this bucket
  queue: number; // queue depth at sample time
  burst: boolean; // 200 ms bucket flagged as a burst
}

export interface SimState {
  rand: () => number;
  price: number;
  drift: number;
  backlog: number;
  processed: number;
  dropped: number;
  batches: number;
  latency: number;
  tick: number;
  burstAt: number; // tick when the last manual burst started (-inf when none)
  microAt: number;
  phase: "steady" | "burst" | "draining";
  samples: Sample[];
}

export function createSim(seed = 7, startPrice = 588.4): SimState {
  return {
    rand: mulberry32(seed),
    price: startPrice,
    drift: 0,
    backlog: 0,
    processed: 2_400_000 + Math.floor(mulberry32(seed + 1)() * 90_000),
    dropped: 0,
    batches: 0,
    latency: 7,
    tick: 0,
    burstAt: -1e9,
    microAt: -1e9,
    phase: "steady",
    samples: [],
  };
}

/** Advance one 200 ms bucket. */
export function stepSim(s: SimState): Sample {
  const r = s.rand;
  s.tick++;

  // Natural micro-bursts every so often keep the stream lively
  if (s.tick - s.microAt > 40 && r() < 0.03) s.microAt = s.tick;

  const age = s.tick - s.burstAt;
  const burst = age >= 0 && age < BURST_TICKS ? 12_500 * (age < 3 ? (age + 1) / 3 : Math.exp(-(age - 3) / 7)) : 0;
  const microAge = s.tick - s.microAt;
  const micro = microAge >= 0 && microAge < 4 ? 2_600 * (1 - microAge / 4) : 0;
  const noise = 1 + (r() - 0.5) * 0.24 + Math.sin(s.tick / 23) * 0.06;
  const incoming = Math.max(0, BASE_PER_TICK * noise + burst + micro);

  // Bounded queue + batch writer. Capacity scales before the bound is reached, so nothing drops.
  const total = s.backlog + incoming;
  let writers = s.backlog > QUEUE_CAP * 0.6 ? DRAIN_BATCHES_HOT : DRAIN_BATCHES;
  if (total - writers * BATCH > QUEUE_CAP) writers = Math.ceil((total - QUEUE_CAP) / BATCH);
  const drained = Math.min(total, writers * BATCH);
  s.backlog = total - drained;
  s.batches += Math.ceil(drained / BATCH);
  s.processed += drained;

  // Queue depth as an observer would sample it mid-bucket
  const queue = Math.min(QUEUE_CAP, s.backlog + incoming * (0.12 + r() * 0.2));
  const drainPerMs = (writers * BATCH) / TICK_MS;
  const targetLatency = 4 + r() * 5 + s.backlog / drainPerMs;
  s.latency += (targetLatency - s.latency) * 0.5;

  const rate = incoming * (1000 / TICK_MS);
  const isBurst = incoming > BASE_PER_TICK * 1.5;

  s.phase = isBurst ? "burst" : s.backlog > 500 ? "draining" : "steady";

  // Underlying price: mean-reverting walk, more volatile while flow is heavy
  const vol = 0.045 * (1 + (incoming / BASE_PER_TICK - 1) * 0.9);
  s.drift = s.drift * 0.92 + (r() - 0.5) * vol;
  s.price = Math.max(1, s.price + s.drift + (r() - 0.5) * vol * 0.6);

  const sample: Sample = { price: s.price, rate, queue, burst: isBurst };
  s.samples.push(sample);
  if (s.samples.length > WINDOW) s.samples.shift();
  return sample;
}

export function triggerBurst(s: SimState): void {
  s.burstAt = s.tick + 1;
}

/** Fill the window so the chart never starts empty. */
export function warmUp(s: SimState, ticks = WINDOW): void {
  for (let i = 0; i < ticks; i++) stepSim(s);
}

/* --------------------------------------------------------- tape prints */

export interface Print {
  sym: string;
  exp: string;
  strike: string;
  kind: "sweep" | "block" | "split";
  premium: string;
  side: "ask" | "bid" | "mid";
}

const UNDERLYINGS: [string, number, number][] = [
  // symbol, reference price for strikes, strike step (simulated values)
  ["SPY", 590, 5],
  ["QQQ", 515, 5],
  ["NVDA", 180, 5],
  ["AAPL", 230, 5],
  ["TSLA", 330, 10],
  ["IWM", 225, 1],
  ["AMD", 160, 5],
  ["MSFT", 510, 5],
  ["META", 720, 10],
  ["AMZN", 225, 5],
];

/** Upcoming Friday expiries as MM/DD, relative to `from`. */
export function upcomingFridays(from: Date, count = 6): string[] {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const out: string[] = [];
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < count; i++) {
    out.push(`${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export function makePrint(rand: () => number, expiries: string[], hot = false): Print {
  const [sym, ref, stepSize] = UNDERLYINGS[Math.floor(rand() * UNDERLYINGS.length)]!;
  const strikeVal = Math.round((ref * (1 + (rand() - 0.5) * 0.08)) / stepSize) * stepSize;
  const cp = rand() < 0.58 ? "C" : "P";
  const kindRoll = rand();
  const kind: Print["kind"] = kindRoll < 0.55 ? "sweep" : kindRoll < 0.8 ? "block" : "split";
  // Log-normal-ish premium, larger during a burst
  const prem = Math.exp(11.6 + rand() * 2.6 + (hot ? 0.8 : 0)); // ~$110K .. ~$4M
  const premium = prem >= 1e6 ? `$${(prem / 1e6).toFixed(1)}M` : `$${Math.round(prem / 1e3)}K`;
  const sideRoll = rand();
  const side: Print["side"] = sideRoll < 0.5 ? "ask" : sideRoll < 0.85 ? "bid" : "mid";
  const exp = expiries[Math.floor(rand() * Math.min(expiries.length, 4))] ?? expiries[0] ?? "";
  return { sym, exp, strike: `${strikeVal}${cp}`, kind, premium, side };
}

/* ------------------------------------------------------------- drawing */

const C = {
  text2: "#b4b8c1",
  text3: "#8a8f98",
  grid: "rgba(255,255,255,0.06)",
  bound: "rgba(255,255,255,0.28)",
  accent: "#8b7cff",
  accent2: "#4fd1c5",
  accent3: "#f5a524",
  queue: "#f7f8f8",
};

interface Geometry {
  w: number;
  h: number;
  dpr: number;
  left: number;
  right: number;
  top: number;
  priceH: number;
  barsTop: number;
  barsH: number;
  fill: CanvasGradient | null;
}

/* --------------------------------------------------------------- init */

export function initLiveMarket(): void {
  const root = document.querySelector<HTMLElement>("[data-market]");
  const wrap = root?.querySelector<HTMLElement>("[data-market-chart]");
  const canvas = wrap?.querySelector<HTMLCanvasElement>("canvas");
  const ctx = canvas?.getContext("2d", { alpha: true });
  if (!root || !wrap || !canvas || !ctx) return;

  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const out = {
    processed: q("[data-m='processed']"),
    latency: q("[data-m='latency']"),
    dropped: q("[data-m='dropped']"),
    queue: q("[data-m='queue']"),
    queueBar: q("[data-m='queue-bar']"),
    rate: q("[data-m='rate']"),
    batches: q("[data-m='batches']"),
    state: q("[data-m='state']"),
  };
  const tape = q<HTMLOListElement>("[data-tape]");
  const burstBtn = q<HTMLButtonElement>("[data-burst]");

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduced = () => motion.matches;

  const sim = createSim(Math.floor(Math.random() * 1e6), 588.4);
  warmUp(sim);
  const printRand = mulberry32(Math.floor(Math.random() * 1e6));
  const expiries = upcomingFridays(new Date());

  const geo: Geometry = { w: 0, h: 0, dpr: 1, left: 0, right: 0, top: 0, priceH: 0, barsTop: 0, barsH: 0, fill: null };
  // Eased axis ranges so the chart never jumps
  const axis = { pMin: 0, pMax: 0, rMax: 0, ready: false };
  let frac = 0;

  /* ---------- sizing ---------- */
  const resize = () => {
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const narrow = w < 520;
    geo.w = w;
    geo.h = h;
    geo.dpr = dpr;
    geo.left = 0;
    geo.right = narrow ? 58 : 72;
    geo.top = 12;
    const plotH = h - geo.top - 8;
    geo.priceH = Math.round(plotH * 0.56);
    geo.barsTop = geo.top + geo.priceH + 22;
    geo.barsH = h - geo.barsTop - 8;
    geo.fill = ctx.createLinearGradient(0, geo.top, 0, geo.top + geo.priceH);
    geo.fill.addColorStop(0, "rgba(79,209,197,0.28)");
    geo.fill.addColorStop(1, "rgba(79,209,197,0)");
  };

  /* ---------- drawing ---------- */
  const draw = (dt: number) => {
    const { w, dpr, left, right, top, priceH, barsTop, barsH } = geo;
    if (!w) return;
    const samples = sim.samples;
    const n = samples.length;
    if (n < 2) return;

    // Axis targets
    let pMin = Infinity;
    let pMax = -Infinity;
    let rMax = 0;
    for (const s of samples) {
      if (s.price < pMin) pMin = s.price;
      if (s.price > pMax) pMax = s.price;
      if (s.rate > rMax) rMax = s.rate;
    }
    const pad = Math.max(0.15, (pMax - pMin) * 0.18);
    pMin -= pad;
    pMax += pad;
    rMax = Math.max(48_000, rMax * 1.12);
    const k = axis.ready ? 1 - Math.exp(-dt * 4) : 1;
    axis.pMin += (pMin - axis.pMin) * k;
    axis.pMax += (pMax - axis.pMax) * k;
    axis.rMax += (rMax - axis.rMax) * k;
    axis.ready = true;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, geo.w, geo.h);

    const plotW = w - left - right;
    const step = plotW / (WINDOW - 1);
    const xAt = (i: number) => left + (i - (n - WINDOW) - frac) * step;
    const yPrice = (p: number) => top + (1 - (p - axis.pMin) / (axis.pMax - axis.pMin)) * priceH;
    const yRate = (r: number) => barsTop + barsH - (r / axis.rMax) * barsH;
    const yQueue = (qd: number) => barsTop + barsH - (qd / QUEUE_CAP) * barsH;

    // Grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    for (let g = 0; g <= 3; g++) {
      const y = Math.round(top + (priceH * g) / 3) + 0.5;
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
    }
    for (let g = 0; g <= 2; g++) {
      const y = Math.round(barsTop + (barsH * g) / 2) + 0.5;
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
    }
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(left, 0, plotW, geo.h);
    ctx.clip();

    // Price area + line
    const last = samples[n - 1]!;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yPrice(samples[i]!.price);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const headX = left + plotW;
    ctx.lineTo(headX, yPrice(last.price));
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = C.accent2;
    ctx.stroke();
    ctx.lineTo(headX, top + priceH);
    ctx.lineTo(xAt(0), top + priceH);
    ctx.closePath();
    if (geo.fill) ctx.fillStyle = geo.fill;
    ctx.fill();

    // Event-rate bars (one per 200 ms bucket)
    const bw = Math.max(1, step * 0.62);
    for (let i = 0; i < n; i++) {
      const s = samples[i]!;
      const x = xAt(i) - bw / 2;
      const y = yRate(s.rate);
      ctx.fillStyle = s.burst ? "rgba(245,165,36,0.85)" : "rgba(139,124,255,0.5)";
      ctx.fillRect(x, y, bw, barsTop + barsH - y);
    }

    // Queue depth line
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = xAt(i);
      const y = yQueue(samples[i]!.queue);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(headX, yQueue(last.queue));
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.queue;
    ctx.stroke();
    ctx.restore();

    // 50k bound
    const yb = Math.round(yQueue(QUEUE_CAP)) + 0.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = C.bound;
    ctx.beginPath();
    ctx.moveTo(left, yb);
    ctx.lineTo(left + plotW, yb);
    ctx.stroke();
    ctx.setLineDash([]);

    // Right-hand labels
    ctx.font = '500 13px "JetBrains Mono", ui-monospace, monospace';
    ctx.textBaseline = "middle";
    const lx = left + plotW + 8;
    const py = Math.min(top + priceH - 10, Math.max(top + 10, yPrice(last.price)));
    ctx.fillStyle = "rgba(79,209,197,0.16)";
    ctx.fillRect(lx - 4, py - 10, right - 6, 20);
    ctx.fillStyle = C.accent2;
    ctx.fillText(last.price.toFixed(2), lx, py);
    ctx.fillStyle = C.text3;
    ctx.fillText("50k", lx, yb);
    ctx.fillText(`${Math.round(axis.rMax / 1000)}k/s`, lx, barsTop + 6);
    ctx.fillText("0", lx, barsTop + barsH - 6);
  };

  /* ---------- burst button state ---------- */
  const btnLabel = burstBtn?.querySelector<HTMLElement>("[data-burst-label]");
  const idleLabel = btnLabel?.textContent ?? "";
  let absorbing = false;
  const setAbsorbing = (on: boolean) => {
    absorbing = on;
    burstBtn?.setAttribute("aria-disabled", String(on));
    if (btnLabel) btnLabel.textContent = on ? "Absorbing burst…" : idleLabel;
  };

  /* ---------- DOM metrics ---------- */
  const stateLabel = { steady: "Steady flow", burst: "Burst detected · 200 ms bucket", draining: "Draining queue" } as const;
  let lastState = "";
  const updateMetrics = () => {
    const last = sim.samples[sim.samples.length - 1];
    if (!last) return;
    if (out.processed) out.processed.textContent = formatInt(sim.processed);
    if (out.latency) out.latency.textContent = formatInt(sim.latency);
    if (out.dropped) out.dropped.textContent = formatInt(sim.dropped);
    if (out.queue) out.queue.textContent = formatInt(last.queue);
    if (out.queueBar) out.queueBar.style.transform = `scaleX(${(last.queue / QUEUE_CAP).toFixed(4)})`;
    if (out.rate) out.rate.textContent = formatInt(last.rate);
    if (out.batches) out.batches.textContent = formatInt(sim.batches);
    if (absorbing && sim.tick - sim.burstAt > 8 && sim.phase === "steady") setAbsorbing(false);
    if (out.state && sim.phase !== lastState) {
      lastState = sim.phase;
      out.state.textContent = stateLabel[sim.phase];
      root.dataset.phase = sim.phase;
    }
  };

  const renderPrint = (p: Print) => {
    const li = document.createElement("li");
    const cells: [string, string][] = [
      ["t-sym", p.sym],
      ["t-exp", p.exp],
      [`t-k ${p.strike.endsWith("C") ? "is-call" : "is-put"}`, p.strike],
      ["t-kind", p.kind],
      ["t-prem", p.premium],
      [`t-side is-${p.side}`, p.side],
    ];
    for (const [cls, text] of cells) {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      li.append(span);
    }
    return li;
  };
  const pushPrint = (hot: boolean) => {
    if (!tape) return;
    const li = renderPrint(makePrint(printRand, expiries, hot));
    if (!reduced()) li.className = "is-new";
    tape.prepend(li);
    while (tape.children.length > 8) tape.lastElementChild?.remove();
  };

  /* ---------- loop ---------- */
  let raf = 0;
  let lastNow = 0;
  let acc = 0;
  let inView = false;

  const onTick = () => {
    const s = stepSim(sim);
    const p = s.burst ? 0.85 : 0.28;
    if (printRand() < p) pushPrint(s.burst);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    acc += dt * 1000;
    let ticked = false;
    while (acc >= TICK_MS) {
      acc -= TICK_MS;
      onTick();
      ticked = true;
    }
    frac = acc / TICK_MS;
    if (ticked) updateMetrics();
    draw(dt);
  };

  const play = () => {
    if (raf || reduced() || !inView || document.hidden) return;
    lastNow = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const staticRender = () => {
    frac = 0;
    draw(1);
    updateMetrics();
  };

  /* ---------- wiring ---------- */
  resize();
  root.classList.add("is-live");
  staticRender();

  new ResizeObserver(() => {
    resize();
    if (!raf) draw(1);
  }).observe(wrap);

  new IntersectionObserver(
    ([entry]) => {
      inView = !!entry?.isIntersecting;
      if (inView) play();
      else pause();
    },
    { rootMargin: "120px 0px" }
  ).observe(root);

  document.addEventListener("visibilitychange", () => (document.hidden ? pause() : play()));
  motion.addEventListener("change", () => {
    if (reduced()) {
      pause();
      staticRender();
    } else play();
  });
  document.fonts?.ready.then(() => {
    if (!raf) draw(1);
  });

  burstBtn?.addEventListener("click", () => {
    if (absorbing) return;
    triggerBurst(sim);
    if (!reduced()) setAbsorbing(true);
    if (reduced()) {
      // Static snapshot: fast-forward through the burst and its drain
      for (let i = 0; i < 45; i++) {
        stepSim(sim);
        if (i % 6 === 0) pushPrint(true);
      }
      staticRender();
    }
  });
}
