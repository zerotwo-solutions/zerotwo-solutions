/**
 * Hero "AI signal field": a WebGL point field whose displacement is computed
 * entirely in the vertex shader (no per-frame CPU loops over vertices).
 *
 * Loading rules (progressive enhancement, the CSS fallback is always visible first):
 * - never with prefers-reduced-motion
 * - only on viewports >= 768px wide or devices reporting deviceMemory >= 4
 * - three.js is fetched with a dynamic import after requestIdleCallback
 *
 * Runtime rules: DPR capped at 1.5, rendering paused when the hero is off-screen
 * or the tab is hidden, everything disposed on pagehide (re-created on bfcache restore).
 */
import type { BufferGeometry, Material, PerspectiveCamera, Vector3, Vector4, WebGLRenderer } from "three";

type ThreeModule = typeof import("three");

const MAX_RIPPLES = 5;
const HALF_W = 24; // field spans x in [-24, 24]
const Z_NEAR = 6; // field spans z in [6, -30]
const Z_FAR = -30;
const TRAIL = 7; // points per data packet

// Brand tokens (sRGB, kept in sRGB space on purpose: no color management in custom shaders)
const ACCENT = [0x8b / 255, 0x7c / 255, 0xff / 255] as const; // --accent
const ACCENT_2 = [0x4f / 255, 0xd1 / 255, 0xc5 / 255] as const; // --accent-2
const ACCENT_3 = [0xf5 / 255, 0xa5 / 255, 0x24 / 255] as const; // --accent-3

/* ------------------------------------------------------------------ GLSL */

const FIELD_GLSL = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
uniform float uFar;
uniform float uHalfW;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec4 uRipples[${MAX_RIPPLES}];

// 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Layered waves + noise + click ripples. p = (x, z) on the plane.
float field(vec2 p) {
  float t = uTime;
  float h = 0.0;
  h += sin(p.x * 0.26 + t * 0.55) * 0.32;
  h += sin(p.y * 0.38 - t * 0.42 + p.x * 0.11) * 0.26;
  h += snoise(p * 0.10 + vec2(t * 0.045, -t * 0.07)) * 0.78;
  h += snoise(p * 0.31 - vec2(t * 0.11, 0.0)) * 0.16;
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    float age = t - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 7.0) continue;
    float d = distance(p, r.xy);
    float front = age * 6.5;
    float env = exp(-abs(d - front) * 0.55) * exp(-age * 0.62) * r.w;
    h += sin((d - front) * 1.5) * env * 1.25;
  }
  return h;
}

float depthFade(float depth) {
  return smoothstep(uFar, uFar * 0.32, depth) * smoothstep(0.8, 3.5, depth);
}
float edgeFade(float x) {
  return 1.0 - smoothstep(uHalfW * 0.68, uHalfW, abs(x));
}
`;

const GRID_VERT = /* glsl */ `
${FIELD_GLSL}
uniform float uSize;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  float h = field(p.xz);
  p.y += h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float k = smoothstep(-0.95, 1.05, h);
  vColor = mix(uColorA, uColorB, k) + vec3(0.32) * smoothstep(0.85, 1.6, h);
  vAlpha = depthFade(depth) * edgeFade(position.x) * (0.28 + 0.72 * k);
  gl_PointSize = max(1.0, uSize * uPixelRatio * (10.0 / depth));
}
`;

const LINE_VERT = /* glsl */ `
${FIELD_GLSL}
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  float h = field(p.xz);
  p.y += h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float k = smoothstep(-0.95, 1.05, h);
  vColor = mix(uColorA, uColorB, k);
  vAlpha = depthFade(-mv.z) * edgeFade(position.x) * 0.16;
}
`;

const PACKET_VERT = /* glsl */ `
${FIELD_GLSL}
attribute float aSpeed;
attribute float aTint;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float phase = position.x;
  float lane = position.y;
  float trail = position.z;
  float span = uHalfW * 2.0;
  float along = phase + uTime * aSpeed - sign(aSpeed) * trail * 0.3;
  float x = mod(along, span) - uHalfW;
  float h = field(vec2(x, lane));
  vec4 mv = modelViewMatrix * vec4(x, h + 0.07, lane, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float head = 1.0 - trail / ${TRAIL.toFixed(1)};
  vec3 base = mix(uColorB, uColorC, aTint);
  vColor = mix(base, vec3(1.0), head * head * 0.55);
  vAlpha = head * head * depthFade(depth) * edgeFade(x);
  gl_PointSize = max(1.0, (1.6 + 4.2 * head) * uPixelRatio * (10.0 / depth));
}
`;

const POINT_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.08, d) * vAlpha;
  if (a < 0.004) discard;
  // Premultiplied output; blending is ONE/ONE so the transparent canvas stays valid.
  gl_FragColor = vec4(vColor * a, a);
}
`;

const LINE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor * vAlpha, vAlpha);
}
`;

/* ------------------------------------------------------------- helpers */

type Idle = (cb: () => void) => void;
const whenIdle: Idle = (cb) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(cb, { timeout: 1500 });
  else window.setTimeout(cb, 200);
};

const isInteractive = (el: EventTarget | null) =>
  el instanceof Element && !!el.closest("a, button, input, select, textarea, label, summary, [role='button']");

interface SceneHandle {
  dispose: () => void;
}

/* --------------------------------------------------------------- scene */

function createScene(T: ThreeModule, hero: HTMLElement, canvas: HTMLCanvasElement): SceneHandle | null {
  const {
    WebGLRenderer: Renderer,
    Scene,
    PerspectiveCamera: Camera,
    BufferGeometry: Geometry,
    BufferAttribute,
    ShaderMaterial,
    Points,
    LineSegments,
    Vector3: Vec3,
    Vector4: Vec4,
    CustomBlending,
    OneFactor,
    AddEquation,
  } = T;

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  let renderer: WebGLRenderer;
  try {
    renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      antialias: dpr <= 1,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    return null; // no WebGL: the CSS fallback stays
  }
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);

  const small = hero.clientWidth < 768;
  const cols = small ? 90 : 160;
  const rows = small ? 50 : 90;

  const scene = new Scene();
  const camera: PerspectiveCamera = new Camera(45, 1, 0.1, 90);
  const camBase = { x: 0, y: 4.2, z: 11 };
  const lookAt: Vector3 = new Vec3(0, 0, -6);

  const ripples: Vector4[] = Array.from({ length: MAX_RIPPLES }, () => new Vec4(0, 0, -100, 0));
  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: dpr },
    uFar: { value: 42 },
    uHalfW: { value: HALF_W },
    uSize: { value: small ? 2.1 : 1.7 },
    uColorA: { value: new Vec3(...ACCENT) },
    uColorB: { value: new Vec3(...ACCENT_2) },
    uColorC: { value: new Vec3(...ACCENT_3) },
    uRipples: { value: ripples },
  };

  const blend = {
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneFactor,
  } as const;

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  // Grid points (static positions; displacement happens on the GPU)
  const gridPos = new Float32Array(cols * rows * 3);
  const dx = (HALF_W * 2) / (cols - 1);
  const dz = (Z_NEAR - Z_FAR) / (rows - 1);
  for (let j = 0, k = 0; j < rows; j++) {
    const z = Z_NEAR - j * dz;
    for (let i = 0; i < cols; i++, k += 3) {
      gridPos[k] = -HALF_W + i * dx;
      gridPos[k + 1] = 0;
      gridPos[k + 2] = z;
    }
  }
  const gridGeo = new Geometry();
  gridGeo.setAttribute("position", new BufferAttribute(gridPos, 3));
  const gridMat = new ShaderMaterial({ uniforms, vertexShader: GRID_VERT, fragmentShader: POINT_FRAG, ...blend });
  const grid = new Points(gridGeo, gridMat);
  grid.frustumCulled = false;
  scene.add(grid);
  geometries.push(gridGeo);
  materials.push(gridMat);

  // Thin "scan lines" every few rows, sharing the same field function
  const lineEvery = small ? 5 : 6;
  const lineRows = Math.floor(rows / lineEvery);
  const linePos = new Float32Array(lineRows * (cols - 1) * 2 * 3);
  for (let r = 0, k = 0; r < lineRows; r++) {
    const z = Z_NEAR - r * lineEvery * dz;
    for (let i = 0; i < cols - 1; i++) {
      linePos[k++] = -HALF_W + i * dx;
      linePos[k++] = 0;
      linePos[k++] = z;
      linePos[k++] = -HALF_W + (i + 1) * dx;
      linePos[k++] = 0;
      linePos[k++] = z;
    }
  }
  const lineGeo = new Geometry();
  lineGeo.setAttribute("position", new BufferAttribute(linePos, 3));
  const lineMat = new ShaderMaterial({ uniforms, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG, ...blend });
  const lines = new LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  scene.add(lines);
  geometries.push(lineGeo);
  materials.push(lineMat);

  // Data packets: bright heads with short trails gliding over the surface
  const packets = small ? 14 : 26;
  const pPos = new Float32Array(packets * TRAIL * 3);
  const pSpeed = new Float32Array(packets * TRAIL);
  const pTint = new Float32Array(packets * TRAIL);
  for (let p = 0; p < packets; p++) {
    const phase = Math.random() * HALF_W * 2;
    const lane = -20 + Math.random() * 22;
    const speed = (2.2 + Math.random() * 3.2) * (Math.random() < 0.5 ? -1 : 1);
    const tint = Math.random() < 0.22 ? 1 : 0;
    for (let t = 0; t < TRAIL; t++) {
      const v = p * TRAIL + t;
      pPos[v * 3] = phase;
      pPos[v * 3 + 1] = lane;
      pPos[v * 3 + 2] = t;
      pSpeed[v] = speed;
      pTint[v] = tint;
    }
  }
  const packetGeo = new Geometry();
  packetGeo.setAttribute("position", new BufferAttribute(pPos, 3));
  packetGeo.setAttribute("aSpeed", new BufferAttribute(pSpeed, 1));
  packetGeo.setAttribute("aTint", new BufferAttribute(pTint, 1));
  const packetMat = new ShaderMaterial({ uniforms, vertexShader: PACKET_VERT, fragmentShader: POINT_FRAG, ...blend });
  const packetPoints = new Points(packetGeo, packetMat);
  packetPoints.frustumCulled = false;
  scene.add(packetPoints);
  geometries.push(packetGeo);
  materials.push(packetMat);

  /* ---------- sizing ---------- */
  const resize = () => {
    const w = Math.max(1, hero.clientWidth);
    const h = Math.max(1, hero.clientHeight);
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    camera.fov = aspect < 0.8 ? 64 : aspect < 1.25 ? 54 : 45;
    camBase.y = aspect < 0.8 ? 5 : 4.2;
    camBase.z = aspect < 0.8 ? 13 : 11;
    camera.updateProjectionMatrix();
  };
  resize();
  camera.position.set(camBase.x, camBase.y, camBase.z);
  camera.lookAt(lookAt);

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0 };
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onPointerLeave = () => {
    pointer.x = 0;
    pointer.y = 0;
  };

  let time = 0;
  let rippleIndex = 0;
  const addRipple = (x: number, z: number, strength = 1) => {
    ripples[rippleIndex]!.set(x, z, time, strength);
    rippleIndex = (rippleIndex + 1) % MAX_RIPPLES;
  };

  const tmp = new Vec3();
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || isInteractive(e.target)) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    tmp.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    let x: number;
    let z: number;
    if (tmp.y < -0.01) {
      const t = -camera.position.y / tmp.y;
      x = camera.position.x + tmp.x * t;
      z = camera.position.z + tmp.z * t;
    } else {
      // Clicked above the horizon: drop the ripple on the far part of the field
      x = nx * HALF_W * 0.6;
      z = -16;
    }
    addRipple(Math.max(-HALF_W, Math.min(HALF_W, x)), Math.max(Z_FAR + 2, Math.min(Z_NEAR - 1, z)));
    if (!raf) renderOnce();
  };

  /* ---------- loop ---------- */
  let raf = 0;
  let last = 0;
  let inView = true;
  let shown = false;
  let disposed = false;

  const step = (dt: number) => {
    time += dt;
    uniforms.uTime.value = time;
    const ease = 1 - Math.exp(-dt * 2.6);
    const tx = camBase.x + pointer.x * 1.6 + Math.sin(time * 0.09) * 0.5;
    const ty = camBase.y - pointer.y * 0.55;
    camera.position.x += (tx - camera.position.x) * ease;
    camera.position.y += (ty - camera.position.y) * ease;
    camera.position.z += (camBase.z - camera.position.z) * ease;
    camera.lookAt(lookAt);
  };

  const renderOnce = () => {
    renderer.render(scene, camera);
  };

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    renderOnce();
    if (!shown) {
      shown = true;
      // Reveal after the first frame has actually been composited
      requestAnimationFrame(() => {
        if (!disposed) hero.classList.add("is-webgl");
      });
    }
  };

  const play = () => {
    if (raf || disposed || !inView || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      inView = !!entry?.isIntersecting;
      if (inView) play();
      else pause();
    },
    { threshold: 0 }
  );
  io.observe(hero);

  const ro = new ResizeObserver(() => {
    resize();
    if (!raf && shown) renderOnce();
  });
  ro.observe(hero);

  const onVisibility = () => (document.hidden ? pause() : play());
  const onContextLost = (e: Event) => {
    e.preventDefault();
    dispose();
  };

  document.addEventListener("visibilitychange", onVisibility);
  hero.addEventListener("pointermove", onPointerMove, { passive: true });
  hero.addEventListener("pointerleave", onPointerLeave, { passive: true });
  hero.addEventListener("pointerdown", onPointerDown, { passive: true });
  canvas.addEventListener("webglcontextlost", onContextLost);

  // A welcome ripple so the field visibly responds once
  time = 0;
  addRipple(4, -7, 0.9);
  play();

  function dispose() {
    if (disposed) return;
    disposed = true;
    pause();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    hero.removeEventListener("pointermove", onPointerMove);
    hero.removeEventListener("pointerleave", onPointerLeave);
    hero.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    hero.classList.remove("is-webgl");
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { dispose };
}

/* ---------------------------------------------------------------- init */

export function initHeroScene(): void {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  const initialCanvas = hero?.querySelector<HTMLCanvasElement>("[data-hero-canvas]");
  if (!hero || !initialCanvas) return;

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0;
  const capable = () => window.innerWidth >= 768 || memory >= 4;
  if (motion.matches || !capable()) return;

  let canvas = initialCanvas;
  let handle: SceneHandle | null = null;
  let loading = false;
  let usedCanvas = false;

  const start = async () => {
    if (handle || loading || motion.matches) return;
    loading = true;
    try {
      const T = await import("three");
      if (usedCanvas) {
        // A canvas whose context was force-lost cannot be reused: swap in a fresh one
        const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
        canvas.replaceWith(fresh);
        canvas = fresh;
      }
      usedCanvas = true;
      handle = createScene(T, hero, canvas);
    } catch {
      handle = null; // network or WebGL failure: keep the CSS fallback
    } finally {
      loading = false;
    }
  };

  const stop = () => {
    handle?.dispose();
    handle = null;
  };

  whenIdle(() => void start());

  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && !motion.matches) whenIdle(() => void start());
  });
  motion.addEventListener("change", () => {
    if (motion.matches) stop();
  });
}
