"use client";

import { useEffect, useRef } from "react";

/**
 * The hero scene: a person at a desk, mid-session, as a rotating 3D wireframe.
 *
 * The body is not a stick figure. It is a mesh generated from an anatomical
 * skeleton — elliptical cross-sections lofted through the torso, tapered tubes
 * swept along each limb, a lofted skull, and hands with individual fingers on
 * the keys. Roughly 400 vertices, built once at module load.
 *
 * Two visual layers: the mesh gives human structure, and a smaller set of
 * anatomical landmarks are drawn as dots on top, which is what keeps it looking
 * like the rest of the site instead of like a 3D model.
 *
 * Hand-rolled rather than pulled from a 3D library — the projection is about
 * fifteen lines, and a WebGL dependency would outweigh the whole site.
 *
 * Decorative, so hidden from assistive tech. Under prefers-reduced-motion it
 * paints one static frame and never loops.
 */

type Vec3 = [number, number, number];

/* -------------------------------------------------------------------------
   Geometry buffers, filled once at module load.
------------------------------------------------------------------------- */

const verts: Vec3[] = [];
const groups: string[] = [];
const edges: [number, number][] = [];
const joints: { at: Vec3; group: string; r: number }[] = [];

let group = "static";

function vert(v: Vec3): number {
  verts.push(v);
  groups.push(group);
  return verts.length - 1;
}

function edge(a: number, b: number) {
  edges.push([a, b]);
}

/** Close a ring of indices into a loop. */
function loop(ids: number[]) {
  for (let i = 0; i < ids.length; i += 1) {
    edge(ids[i], ids[(i + 1) % ids.length]);
  }
}

/** Connect two rings of equal length lengthwise. */
function bridge(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i += 1) {
    edge(a[i], b[i]);
  }
}

/** A horizontal elliptical cross-section — used for torso, neck and skull. */
function section(
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  rz: number,
  n: number,
): number[] {
  const ids: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    ids.push(vert([cx + Math.cos(a) * rx, cy, cz + Math.sin(a) * rz]));
  }
  return ids;
}

/** Loft a stack of cross-sections into a shell. */
function stack(sections: number[][]) {
  sections.forEach((ring, i) => {
    loop(ring);
    if (i > 0) {
      bridge(sections[i - 1], ring);
    }
  });
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** A ring perpendicular to `dir`, for limbs running at arbitrary angles. */
function ringAt(p: Vec3, dir: Vec3, r: number, n: number): number[] {
  const d = norm(dir);
  const seed: Vec3 = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(seed, d));
  const v = cross(d, u);

  const ids: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const cs = Math.cos(a) * r;
    const sn = Math.sin(a) * r;
    ids.push(
      vert([
        p[0] + u[0] * cs + v[0] * sn,
        p[1] + u[1] * cs + v[1] * sn,
        p[2] + u[2] * cs + v[2] * sn,
      ]),
    );
  }
  return ids;
}

/** A tapered tube swept from a to b — one limb bone. */
function tube(a: Vec3, b: Vec3, r0: number, r1: number, n: number, steps = 2) {
  const dir = sub(b, a);
  const rings: number[][] = [];
  for (let s = 0; s <= steps; s += 1) {
    const f = s / steps;
    const p: Vec3 = [
      a[0] + dir[0] * f,
      a[1] + dir[1] * f,
      a[2] + dir[2] * f,
    ];
    rings.push(ringAt(p, dir, r0 + (r1 - r0) * f, n));
  }
  rings.forEach((ring, i) => {
    loop(ring);
    if (i > 0) {
      bridge(rings[i - 1], ring);
    }
  });
}

/** A flat quad, for desk surfaces and screens. */
function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number[] {
  const ids = [vert(a), vert(b), vert(c), vert(d)];
  loop(ids);
  return ids;
}

function landmark(at: Vec3, r = 1) {
  joints.push({ at, group, r });
}

/* -------------------------------------------------------------------------
   The skeleton. Figure faces +X, seated, leaning slightly forward.
------------------------------------------------------------------------- */

const shoulderL: Vec3 = [0.45, 1.24, -0.225];
const shoulderR: Vec3 = [0.45, 1.24, 0.225];
const elbowL: Vec3 = [0.68, 0.99, -0.3];
const elbowR: Vec3 = [0.7, 0.99, 0.32];
const wristL: Vec3 = [1.02, 0.8, -0.17];
const wristR: Vec3 = [1.06, 0.8, 0.4];
const knuckL: Vec3 = [1.16, 0.765, -0.17];
const knuckR: Vec3 = [1.19, 0.775, 0.41];

const hipL: Vec3 = [0.3, 0.58, -0.16];
const hipR: Vec3 = [0.3, 0.58, 0.16];
const kneeL: Vec3 = [0.88, 0.54, -0.19];
const kneeR: Vec3 = [0.88, 0.54, 0.19];
const ankleL: Vec3 = [0.95, 0.12, -0.19];
const ankleR: Vec3 = [0.95, 0.12, 0.19];
const toeL: Vec3 = [1.14, 0.05, -0.19];
const toeR: Vec3 = [1.14, 0.05, 0.19];

/* ---- torso: lofted elliptical sections, waist in, shoulders out ---- */
group = "torso";
stack([
  section(0.3, 0.56, 0, 0.135, 0.175, 10),
  section(0.32, 0.72, 0, 0.125, 0.16, 10),
  section(0.35, 0.88, 0, 0.11, 0.14, 10),
  section(0.39, 1.02, 0, 0.13, 0.175, 10),
  section(0.42, 1.14, 0, 0.14, 0.205, 10),
  section(0.45, 1.26, 0, 0.12, 0.225, 10),
  section(0.47, 1.34, 0, 0.07, 0.08, 10),
]);
landmark([0.3, 0.56, 0], 1.1);
landmark([0.42, 1.14, 0], 1.1);
landmark(shoulderL, 1.2);
landmark(shoulderR, 1.2);

/* ---- neck and skull ---- */
group = "head";
stack([
  section(0.47, 1.34, 0, 0.07, 0.08, 8),
  section(0.49, 1.42, 0, 0.058, 0.062, 8),
  section(0.51, 1.49, 0, 0.075, 0.072, 8),
  section(0.52, 1.535, 0, 0.093, 0.085, 8),
  section(0.525, 1.61, 0, 0.108, 0.096, 8),
  section(0.52, 1.69, 0, 0.1, 0.09, 8),
  section(0.51, 1.76, 0, 0.062, 0.058, 8),
]);
{
  const crown = vert([0.51, 1.795, 0]);
  const topRing = section(0.51, 1.76, 0, 0.062, 0.058, 8);
  topRing.forEach((id) => edge(id, crown));
}
landmark([0.52, 1.6, 0], 1.3);
landmark([0.5, 1.49, 0], 0.9);

/* ---- arms ---- */
group = "armL";
tube(shoulderL, elbowL, 0.075, 0.052, 6, 2);
group = "foreL";
tube(elbowL, wristL, 0.052, 0.04, 6, 2);
group = "armR";
tube(shoulderR, elbowR, 0.075, 0.052, 6, 2);
group = "foreR";
tube(elbowR, wristR, 0.052, 0.04, 6, 2);

group = "armL";
landmark(elbowL, 1.1);
group = "armR";
landmark(elbowR, 1.1);
group = "foreL";
landmark(wristL, 1);
group = "foreR";
landmark(wristR, 1);

/* ---- hands: palm plus four fingers, tips resting on the hardware ---- */
group = "handL";
tube(wristL, knuckL, 0.04, 0.05, 6, 1);
for (let f = 0; f < 4; f += 1) {
  const z = knuckL[2] + (f - 1.5) * 0.035;
  const a = vert([knuckL[0], knuckL[1], z]);
  const b = vert([knuckL[0] + 0.055, knuckL[1] - 0.02, z]);
  const c = vert([knuckL[0] + 0.095, knuckL[1] - 0.045, z]);
  edge(a, b);
  edge(b, c);
}
landmark(knuckL, 1);

group = "handR";
tube(wristR, knuckR, 0.04, 0.05, 6, 1);
for (let f = 0; f < 4; f += 1) {
  const z = knuckR[2] + (f - 1.5) * 0.032;
  const a = vert([knuckR[0], knuckR[1], z]);
  const b = vert([knuckR[0] + 0.05, knuckR[1] - 0.015, z]);
  const c = vert([knuckR[0] + 0.085, knuckR[1] - 0.03, z]);
  edge(a, b);
  edge(b, c);
}
landmark(knuckR, 1);
// the mouse travels with the hand on it
stack([
  section(1.22, 0.74, 0.41, 0.055, 0.042, 6),
  section(1.22, 0.775, 0.41, 0.04, 0.03, 6),
]);

/* ---- legs, folded under the desk ---- */
group = "static";
tube(hipL, kneeL, 0.11, 0.075, 6, 2);
tube(hipR, kneeR, 0.11, 0.075, 6, 2);
tube(kneeL, ankleL, 0.075, 0.048, 6, 2);
tube(kneeR, ankleR, 0.075, 0.048, 6, 2);
tube(ankleL, toeL, 0.048, 0.035, 5, 1);
tube(ankleR, toeR, 0.048, 0.035, 5, 1);
[hipL, hipR, kneeL, kneeR, ankleL, ankleR].forEach((p) => landmark(p, 1));

/* ---- chair ---- */
quad(
  [-0.1, 0.52, -0.32],
  [0.66, 0.52, -0.32],
  [0.66, 0.52, 0.32],
  [-0.1, 0.52, 0.32],
);
quad(
  [-0.06, 0.55, -0.3],
  [-0.2, 1.32, -0.28],
  [-0.2, 1.32, 0.28],
  [-0.06, 0.55, 0.3],
);
tube([0.24, 0.52, 0], [0.24, -0.16, 0], 0.035, 0.045, 5, 1);
for (let s = 0; s < 5; s += 1) {
  const a = (s / 5) * Math.PI * 2;
  const foot: Vec3 = [
    0.24 + Math.cos(a) * 0.4,
    -0.28,
    Math.sin(a) * 0.4,
  ];
  const hub = vert([0.24, -0.16, 0]);
  edge(hub, vert(foot));
  landmark(foot, 0.8);
}

/* ---- desk: a slab with thickness, plus far legs ---- */
{
  const top = quad(
    [0.95, 0.7, -1.02],
    [2.75, 0.7, -1.02],
    [2.75, 0.7, 1.02],
    [0.95, 0.7, 1.02],
  );
  const under = quad(
    [0.95, 0.655, -1.02],
    [2.75, 0.655, -1.02],
    [2.75, 0.655, 1.02],
    [0.95, 0.655, 1.02],
  );
  bridge(top, under);
}
tube([2.68, 0.655, -0.95], [2.68, -0.38, -0.95], 0.03, 0.03, 4, 1);
tube([2.68, 0.655, 0.95], [2.68, -0.38, 0.95], 0.03, 0.03, 4, 1);

/* ---- keyboard ---- */
{
  const top = quad(
    [1.0, 0.725, -0.38],
    [1.64, 0.725, -0.38],
    [1.64, 0.725, 0.38],
    [1.0, 0.725, 0.38],
  );
  const base = quad(
    [1.0, 0.7, -0.38],
    [1.64, 0.7, -0.38],
    [1.64, 0.7, 0.38],
    [1.0, 0.7, 0.38],
  );
  bridge(top, base);
}

/* ---- monitor ---- */
const SCREEN: Vec3[] = [
  [2.32, 0.88, -0.74],
  [2.32, 1.88, -0.74],
  [2.32, 1.88, 0.74],
  [2.32, 0.88, 0.74],
];
{
  const front = quad(SCREEN[0], SCREEN[1], SCREEN[2], SCREEN[3]);
  const back = quad(
    [2.44, 0.9, -0.7],
    [2.44, 1.86, -0.7],
    [2.44, 1.86, 0.7],
    [2.44, 0.9, 0.7],
  );
  bridge(front, back);
}
tube([2.37, 0.88, 0], [2.37, 0.715, 0], 0.045, 0.06, 5, 1);
loop(section(2.37, 0.71, 0, 0.1, 0.17, 8));

/* -------------------------------------------------------------------------
   Camera and framing.
------------------------------------------------------------------------- */

const CENTRE: Vec3 = [1.28, 0.71, 0];
const CAM_DIST = 6.5;
const FOCAL = 6.5;

/**
 * Lifts the framing without moving the rotation pivot. The camera tilt pushes
 * near-side geometry (chair feet, desk legs) downward, so a scene centred on
 * its own midpoint sits low and clips along the bottom edge.
 */
const FRAME_LIFT = 0.26;

/** Depth buckets, so ~700 edges cost a dozen canvas state changes, not 700. */
const BUCKETS = 12;

/** Idle auto-rotation, radians per second. */
const AUTO_RATE = 0.26;
/** How long the scene must sit untouched before auto-rotation fades back in. */
const IDLE_RESUME = 1.5;
/** Drag sensitivity, in radians per pixel. */
const DRAG_SPIN = 0.008;
const DRAG_TILT = 0.004;
/** Tilt is clamped so the scene can never be dragged edge-on or upside down. */
const TILT_MIN = -0.2;
const TILT_MAX = 0.6;
/** Flung spin is capped so a fast swipe cannot send it into a blur. */
const MAX_FLING = 6;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** Per-group motion, applied in 3D so it survives the rotation. */
function offsetFor(g: string, t: number): Vec3 {
  switch (g) {
    case "head":
      return [Math.sin(t * 1.9) * 0.008, Math.sin(t * 2.3) * 0.026, 0];
    case "torso":
      return [0, Math.sin(t * 1.4) * 0.011, 0];
    case "handL":
      return [0, Math.abs(Math.sin(t * 13)) * 0.03, 0];
    case "foreL":
      return [0, Math.abs(Math.sin(t * 13)) * 0.012, 0];
    case "handR":
      return [Math.sin(t * 1.3) * 0.025, 0, Math.sin(t * 0.9) * 0.04];
    case "foreR":
      return [Math.sin(t * 1.3) * 0.01, 0, Math.sin(t * 0.9) * 0.016];
    default:
      return [0, 0, 0];
  }
}

export default function GamerScene() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const acid =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--acid")
        .trim() || "#c6f000";

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /** Rotate about the scene centre, then perspective-divide. */
    function project(p: Vec3, spin: number, tilt: number) {
      const x0 = p[0] - CENTRE[0];
      const y0 = p[1] - CENTRE[1];
      const z0 = p[2] - CENTRE[2];

      const cs = Math.cos(spin);
      const sn = Math.sin(spin);
      const x1 = x0 * cs + z0 * sn;
      const z1 = -x0 * sn + z0 * cs;

      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const y2 = y0 * ct - z1 * st;
      const z2 = y0 * st + z1 * ct;

      // Height-limited on desktop, width-limited on phones. The divisors carry
      // headroom for the worst rotation angle, not just the resting one: the
      // scene is widest on screen around 60-70 degrees of spin, where the far
      // desk corners swing out and perspective is still magnifying them.
      const scale = Math.min(width / 4.0, height / 3.75);
      const persp = FOCAL / (CAM_DIST - z2);

      return {
        x: width / 2 + x1 * persp * scale,
        y: height / 2 - y2 * persp * scale - FRAME_LIFT * scale,
        z: z2,
      };
    }

    /** Farther geometry is dimmer and thinner — the only depth cue needed. */
    function depth(z: number) {
      return Math.min(1, Math.max(0, (z + 2.2) / 4.4));
    }

    function render(t: number, spin: number, tilt: number) {
      ctx!.clearRect(0, 0, width, height);
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";

      const offsets: Record<string, Vec3> = {};
      const at = verts.map((v, i) => {
        const g = groups[i];
        const o = (offsets[g] ??= offsetFor(g, t));
        return project([v[0] + o[0], v[1] + o[1], v[2] + o[2]], spin, tilt);
      });

      // the screen itself, flickering
      ctx!.beginPath();
      SCREEN.forEach((p, i) => {
        const q = project(p, spin, tilt);
        if (i === 0) {
          ctx!.moveTo(q.x, q.y);
        } else {
          ctx!.lineTo(q.x, q.y);
        }
      });
      ctx!.closePath();
      ctx!.fillStyle = acid;
      ctx!.globalAlpha = reduced
        ? 0.12
        : 0.07 + Math.abs(Math.sin(t * 3.1)) * 0.09;
      ctx!.fill();

      // edges, bucketed far to near
      const paths = Array.from({ length: BUCKETS }, () => new Path2D());
      for (const [a, b] of edges) {
        const pa = at[a];
        const pb = at[b];
        const d = depth((pa.z + pb.z) / 2);
        const bi = Math.min(BUCKETS - 1, Math.floor(d * BUCKETS));
        paths[bi].moveTo(pa.x, pa.y);
        paths[bi].lineTo(pb.x, pb.y);
      }

      ctx!.strokeStyle = acid;
      for (let i = 0; i < BUCKETS; i += 1) {
        const d = (i + 0.5) / BUCKETS;
        ctx!.globalAlpha = 0.07 + d * 0.4;
        ctx!.lineWidth = 0.5 + d * 0.85;
        ctx!.stroke(paths[i]);
      }

      // anatomical landmarks on top
      ctx!.fillStyle = acid;
      const dots = joints
        .map((j) => {
          const o = (offsets[j.group] ??= offsetFor(j.group, t));
          return {
            p: project(
              [j.at[0] + o[0], j.at[1] + o[1], j.at[2] + o[2]],
              spin,
              tilt,
            ),
            r: j.r,
          };
        })
        .sort((m, n) => m.p.z - n.p.z);

      for (const dot of dots) {
        const d = depth(dot.p.z);
        ctx!.globalAlpha = 0.35 + d * 0.65;
        ctx!.beginPath();
        ctx!.arc(dot.p.x, dot.p.y, (1.1 + d * 2.1) * dot.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      ctx!.globalAlpha = 1;
    }

    resize();

    const start = performance.now();

    /* ---- orbit state ---- */
    let spin = -0.6;
    let tilt = 0.19;
    let velocity = 0; // radians/sec, carried after a fling
    let autoBlend = reduced ? 0 : 1; // how much idle rotation is mixed in
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastMoveAt = 0;
    let idleSince = performance.now();

    let frame = 0;
    let running = false;
    let prev = performance.now();

    function draw(now: number) {
      const t = (now - start) / 1000;
      // The resting sway is part of the idle behaviour, so it fades out with it.
      const sway = reduced ? 0 : Math.sin(t * 0.33) * 0.07 * autoBlend;
      // Under reduced motion the loop still runs while the user drags, but the
      // body's involuntary motions stay frozen: only rotation they are actively
      // driving should move. Freezing the clock is what holds them still.
      render(reduced ? 0 : t, spin, tilt + sway);
    }

    function step(now: number) {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      if (!dragging) {
        // Inertia from the last fling, decaying frame-rate independently.
        spin += velocity * dt;
        velocity *= Math.pow(0.93, dt * 60);
        if (Math.abs(velocity) < 0.002) {
          velocity = 0;
        }

        if (!reduced) {
          const idle = (now - idleSince) / 1000;
          const target = idle > IDLE_RESUME && Math.abs(velocity) < 0.2 ? 1 : 0;
          // Ease rather than snap, so idle rotation does not jerk back in.
          autoBlend += (target - autoBlend) * Math.min(1, dt * 1.6);
          spin += AUTO_RATE * autoBlend * dt;
        }
      }

      draw(now);

      // Under reduced motion there is nothing to animate once the user lets go,
      // so the loop stops entirely rather than burning frames on a still image.
      if (reduced && !dragging && velocity === 0) {
        running = false;
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(step);
    }

    function ensureLoop() {
      if (running) {
        return;
      }
      running = true;
      prev = performance.now();
      frame = requestAnimationFrame(step);
    }

    // Paint one frame synchronously. requestAnimationFrame does not fire while
    // the document is hidden, so without this the panel is blank for anyone who
    // opens the site in a background tab until they first look at it.
    draw(performance.now());

    if (!reduced) {
      ensureLoop();
    }

    /* ---- pointer orbit ---- */

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      velocity = 0;
      autoBlend = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveAt = performance.now();
      idleSince = lastMoveAt;
      hintRef.current?.style.setProperty("opacity", "0");
      ensureLoop();

      // Capture keeps a drag alive once the pointer leaves the band, but it is
      // an enhancement, not a requirement — and it must come last. If it throws,
      // everything above has already run, so the drag still works while the
      // pointer stays over the scene instead of the widget freezing mid-gesture.
      try {
        wrap!.setPointerCapture(e.pointerId);
      } catch {
        // no capture available; drag remains usable within the element
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) {
        return;
      }
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      spin += dx * DRAG_SPIN;
      tilt = clamp(tilt + dy * DRAG_TILT, TILT_MIN, TILT_MAX);

      const dt = Math.max(now - lastMoveAt, 8) / 1000;
      velocity = clamp((dx * DRAG_SPIN) / dt, -MAX_FLING, MAX_FLING);
      lastMoveAt = now;
      idleSince = now;
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging) {
        return;
      }
      dragging = false;
      idleSince = performance.now();
      // A held-still pointer should not fling on release.
      if (performance.now() - lastMoveAt > 120) {
        velocity = 0;
      }
      try {
        if (wrap!.hasPointerCapture(e.pointerId)) {
          wrap!.releasePointerCapture(e.pointerId);
        }
      } catch {
        // capture was never taken, or already gone
      }
      ensureLoop();
    }

    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerUp);

    const observer = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    observer.observe(wrap);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerup", onPointerUp);
      wrap.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      // touch-pan-y keeps vertical page scrolling working on phones — without
      // it, a swipe that starts on this full-width band traps the page.
      // On phones the scene is width-limited, so a tall band would just be dead
      // space; 95vw tracks how much height the figure can actually use there.
      // Beside the wordmark the band takes a 16:15 aspect, which is exactly
      // where the projection's width and height limits meet — any other shape
      // leaves one axis binding early and wastes the other. Stacked on phones
      // it falls back to tracking viewport width, where width always binds.
      className="relative h-[clamp(360px,min(88vh,95vw),1000px)] w-full cursor-grab touch-pan-y select-none active:cursor-grabbing lg:aspect-[16/15] lg:h-auto lg:max-h-[88vh]"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div
        ref={hintRef}
        className="mono pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 text-[9px] tracking-[0.15em] text-[var(--muted)] uppercase opacity-70 transition-opacity duration-500 sm:text-[10px]"
      >
        DRAG TO ROTATE
      </div>
    </div>
  );
}
