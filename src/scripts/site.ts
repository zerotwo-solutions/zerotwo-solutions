// Global, tiny, progressive enhancements shared by every page.
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scroll reveal
const revealEls = document.querySelectorAll<HTMLElement>("[data-reveal]");
if ("IntersectionObserver" in window && !reduced) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"));
}

// Sticky nav state
const navEl = document.querySelector<HTMLElement>("[data-nav]");
const onScroll = () => navEl?.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Mobile menu
const toggle = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
const menu = document.getElementById("mobile-menu");
toggle?.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  if (menu) menu.hidden = !open;
  navEl?.classList.toggle("is-open", open);
});

// Pointer spotlight on cards (one delegated listener)
document.addEventListener(
  "pointermove",
  (e) => {
    const card = (e.target as Element | null)?.closest?.<HTMLElement>(".spotlight");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  },
  { passive: true }
);

// Count-up numbers: <span data-count="1500" data-suffix="+">
const counters = document.querySelectorAll<HTMLElement>("[data-count]");
const fmt = new Intl.NumberFormat("en-US");
const runCount = (el: HTMLElement) => {
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix ?? "";
  if (reduced || !Number.isFinite(target)) {
    el.textContent = fmt.format(target) + suffix;
    return;
  }
  const start = performance.now();
  const dur = 1400;
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt.format(Math.round(target * eased)) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
if ("IntersectionObserver" in window) {
  const cio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          runCount(e.target as HTMLElement);
          cio.unobserve(e.target);
        }
      }
    },
    { threshold: 0.4 }
  );
  counters.forEach((el) => cio.observe(el));
}
