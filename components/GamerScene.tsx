"use client";

import { useEffect, useRef } from "react";

/**
 * The hero scene: a person at a desk, mid-session, as a rotating 3D wireframe.
 *
 * The body is not a stick figure. It is a mesh generated from an anatomical
 * skeleton — elliptical cross-sections lofted through the torso, tapered tubes
 * swept along each limb, a lofted skull, and hands with individual fingers.
 * 493 vertices and 693 edges, built once at module load.
 *
 * He does not only type. A scheduler cycles him through activities — keyboard
 * and mouse, a controller, a phone held upright, and the occasional loss of
 * composure where he slams both palms on the desk. Poses are driven by
 * two-bone IK on each arm, so a pose is written as "put the wrist here" and
 * the elbow follows without the limb ever stretching.
 *
 * Two visual layers: the mesh gives human structure, and a smaller set of
 * anatomical landmarks are drawn as dots on top, which is what keeps it looking
 * like the rest of the site instead of like a 3D model.
 *
 * Hand-rolled rather than pulled from a 3D library — the projection is about
 * fifteen lines, and a WebGL dependency would outweigh the whole site.
 *
 * Decorative, so hidden from assistive tech. Under prefers-reduced-motion it
 * paints one static frame of the keyboard pose and never loops.
 */

type Vec3 = [number, number, number];
/** Row-major 3x3. Hand-rolled maths kernel; a tuple type buys nothing here. */
type Mat3 = number[];

/* -------------------------------------------------------------------------
   Geometry buffers, filled once at module load.
------------------------------------------------------------------------- */

const verts: Vec3[] = [];
const groups: string[] = [];
const edges: [number, number][] = [];
const joints: { at: Vec3; group: string; r: number }[] = [];

/**
 * Props that only exist during one activity keep their edges out of the main
 * list, so a hidden controller costs nothing to skip. It also has to be a skip
 * rather than a zero alpha: `lineCap: "round"` paints a dot for a zero-length
 * line, so a collapsed prop would leave a stray speck behind.
 */
const propEdges: Record<string, [number, number][]> = { pad: [], phone: [] };

let group = "static";

function vert(v: Vec3): number {
  verts.push(v);
  groups.push(group);
  return verts.length - 1;
}

function edge(a: number, b: number) {
  (propEdges[group] ?? edges).push([a, b]);
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

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scaled(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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

/** A box with thickness, given two parallel quads. */
function slab(a: Vec3[], b: Vec3[]) {
  bridge(quad(a[0], a[1], a[2], a[3]), quad(b[0], b[1], b[2], b[3]));
}

function landmark(at: Vec3, r = 1) {
  joints.push({ at, group, r });
}

/* -------------------------------------------------------------------------
   The skeleton. Figure faces +X, seated, leaning slightly forward.

   Rest pose is the keyboard-and-mouse pose: every other activity is expressed
   as a departure from it, and the rig reproduces this pose exactly when no
   activity is asking for anything else.
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

/** Pelvis centre — the torso leans about this. */
const HIP: Vec3 = [0.31, 0.57, 0];
/** Base of the neck — the head turns about this. */
const NECK: Vec3 = [0.47, 1.34, 0];
/** Roughly where the eyes are; head aim is measured from here, not the pivot. */
const EYES: Vec3 = [0.52, 1.6, 0];

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

/* ---- hands: palm plus four fingers ---- */
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

/* ---- the mouse, on the desk under the right hand ---- */
group = "mouse";
stack([
  section(1.22, 0.74, 0.41, 0.055, 0.042, 6),
  section(1.22, 0.775, 0.41, 0.04, 0.03, 6),
]);

/* -------------------------------------------------------------------------
   Props. Both are modelled where they are actually held, not in the rest
   hand — the pose that uses one places the wrists around it by design, so
   authoring them in place is what makes the grip line up.
------------------------------------------------------------------------- */

/* ---- gamepad, held in front of the chest ---- */
group = "pad";
slab(
  [
    [0.9, 1.005, -0.19],
    [1.05, 1.005, -0.19],
    [1.05, 1.005, 0.19],
    [0.9, 1.005, 0.19],
  ],
  [
    [0.9, 0.945, -0.19],
    [1.05, 0.945, -0.19],
    [1.05, 0.945, 0.19],
    [0.9, 0.945, 0.19],
  ],
);
// grips fall away from the body of the pad, back towards the palms
tube([0.94, 0.95, -0.16], [0.88, 0.855, -0.225], 0.03, 0.022, 5, 1);
tube([0.94, 0.95, 0.16], [0.88, 0.855, 0.225], 0.03, 0.022, 5, 1);
loop(section(0.98, 1.008, -0.08, 0.022, 0.022, 6));
loop(section(0.98, 1.008, 0.08, 0.022, 0.022, 6));
landmark([0.98, 1.012, -0.08], 0.9);
landmark([0.98, 1.012, 0.08], 0.9);

/* ---- phone, held upright in the left hand ---- */
group = "phone";
slab(
  [
    [0.838, 1.16, -0.085],
    [0.838, 1.5, -0.085],
    [0.838, 1.5, 0.085],
    [0.838, 1.16, 0.085],
  ],
  [
    [0.862, 1.16, -0.085],
    [0.862, 1.5, -0.085],
    [0.862, 1.5, 0.085],
    [0.862, 1.16, 0.085],
  ],
);
/** The lit face, filled like the monitor. Faces -X, which is where he is. */
const PHONE_SCREEN: Vec3[] = [
  [0.836, 1.19, -0.068],
  [0.836, 1.47, -0.068],
  [0.836, 1.47, 0.068],
  [0.836, 1.19, 0.068],
];

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
slab(
  [
    [0.95, 0.7, -1.02],
    [2.75, 0.7, -1.02],
    [2.75, 0.7, 1.02],
    [0.95, 0.7, 1.02],
  ],
  [
    [0.95, 0.655, -1.02],
    [2.75, 0.655, -1.02],
    [2.75, 0.655, 1.02],
    [0.95, 0.655, 1.02],
  ],
);
tube([2.68, 0.655, -0.95], [2.68, -0.38, -0.95], 0.03, 0.03, 4, 1);
tube([2.68, 0.655, 0.95], [2.68, -0.38, 0.95], 0.03, 0.03, 4, 1);

/* ---- keyboard: its own group so it can jump when the desk is hit ---- */
group = "keyboard";
slab(
  [
    [1.0, 0.725, -0.38],
    [1.64, 0.725, -0.38],
    [1.64, 0.725, 0.38],
    [1.0, 0.725, 0.38],
  ],
  [
    [1.0, 0.7, -0.38],
    [1.64, 0.7, -0.38],
    [1.64, 0.7, 0.38],
    [1.0, 0.7, 0.38],
  ],
);

/* ---- monitor ---- */
group = "static";
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

/** Where he looks when he is looking at the monitor. */
const SCREEN_MID: Vec3 = [2.32, 1.38, 0];

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

function lerp(a: number, b: number, k: number) {
  return a + (b - a) * k;
}

function lerp3(a: Vec3, b: Vec3, k: number): Vec3 {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

/* -------------------------------------------------------------------------
   The rig.

   Every animated group gets one affine map: p -> to + m * (p - from). Arms are
   posed by two-bone IK, so an activity says where the wrist goes and the elbow
   is solved for. Bones keep their rest length by construction — an unreachable
   target straightens the arm rather than stretching it.
------------------------------------------------------------------------- */

type Xform = { m: Mat3; from: Vec3; to: Vec3 };

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const ORIGIN: Vec3 = [0, 0, 0];

function matVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function matMul(a: Mat3, b: Mat3): Mat3 {
  const o: number[] = new Array(9);
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      o[r * 3 + c] =
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
  }
  return o;
}

function apply(x: Xform, p: Vec3): Vec3 {
  return add(x.to, matVec(x.m, sub(p, x.from)));
}

/** Rotation about the lateral axis: pitching forward and back. */
function rotZ(a: number): Mat3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * Shortest rotation taking direction `a` onto direction `b` (Rodrigues). Used
 * to swing a bone from its rest direction to wherever the pose wants it: the
 * twist about the bone's own axis is left alone, which is invisible on a
 * near-circular tube and saves carrying a full orientation per joint.
 */
function align(a: Vec3, b: Vec3): Mat3 {
  const u = norm(a);
  const v = norm(b);
  const c = clamp(dot(u, v), -1, 1);
  const axis = cross(u, v);
  const s = Math.hypot(axis[0], axis[1], axis[2]);
  if (s < 1e-6) {
    // Parallel, or antiparallel — the poses never fold a bone back on itself,
    // so the only case that reaches here is "already aligned".
    return IDENTITY;
  }
  const [x, y, z] = scaled(axis, 1 / s);
  const t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

/** Where the elbow goes, given a shoulder, a wrist target and a pole hint. */
function solveElbow(
  s: Vec3,
  w: Vec3,
  l1: number,
  l2: number,
  pole: Vec3,
): Vec3 {
  const d = sub(w, s);
  const reach = Math.hypot(d[0], d[1], d[2]);
  // Clamped just inside full extension: a straight arm has no defined elbow
  // plane, and an over-reaching target would otherwise pull the bones apart.
  const len = clamp(reach, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const n = norm(d);
  const cosA = clamp((l1 * l1 + len * len - l2 * l2) / (2 * l1 * len), -1, 1);
  const a = Math.acos(cosA);
  let u = sub(pole, scaled(n, dot(pole, n)));
  if (Math.hypot(u[0], u[1], u[2]) < 1e-6) {
    u = [0, -1, 0];
  }
  u = norm(u);
  return add(add(s, scaled(n, l1 * Math.cos(a))), scaled(u, l1 * Math.sin(a)));
}

const BONE = {
  upperL: Math.hypot(...sub(elbowL, shoulderL)),
  foreL: Math.hypot(...sub(wristL, elbowL)),
  upperR: Math.hypot(...sub(elbowR, shoulderR)),
  foreR: Math.hypot(...sub(wristR, elbowR)),
};

/**
 * The rest pose's own elbow direction, reused as the default pole. Feeding it
 * back in is what makes the solver reproduce the modelled pose exactly rather
 * than approximately — the keyboard pose is bit-identical to the geometry.
 */
function restPole(s: Vec3, e: Vec3, w: Vec3): Vec3 {
  const n = norm(sub(w, s));
  const v = sub(e, s);
  return norm(sub(v, scaled(n, dot(v, n))));
}
const POLE_L = restPole(shoulderL, elbowL, wristL);
const POLE_R = restPole(shoulderR, elbowR, wristR);

/** Head aim in the rest pose — straight at the middle of the monitor. */
const REST_LOOK = norm(sub(SCREEN_MID, EYES));

/* -------------------------------------------------------------------------
   Poses and activities.
------------------------------------------------------------------------- */

type Pose = {
  /** Torso pitch in radians; positive leans forward. */
  lean: number;
  /** Point the eyes are aimed at. */
  look: Vec3;
  wristL: Vec3;
  poleL: Vec3;
  wristR: Vec3;
  poleR: Vec3;
  /** Prop drift, so a held prop shares the hand's wander. */
  propAt: Vec3;
  /** Mouse drift, so it travels under the hand pushing it. */
  mouse: Vec3;
  /** Prop opacity, 0..1 — also gates whether the prop is drawn at all. */
  pad: number;
  phone: number;
  /** Impact energy, 0..1, decaying after a hit. Drives shake and rattle. */
  shake: number;
};

function makePose(o: Partial<Pose>): Pose {
  return {
    lean: 0,
    look: SCREEN_MID,
    wristL,
    poleL: POLE_L,
    wristR,
    poleR: POLE_R,
    propAt: ORIGIN,
    mouse: ORIGIN,
    pad: 0,
    phone: 0,
    shake: 0,
    ...o,
  };
}

function mixPose(a: Pose, b: Pose, k: number): Pose {
  return {
    lean: lerp(a.lean, b.lean, k),
    look: lerp3(a.look, b.look, k),
    wristL: lerp3(a.wristL, b.wristL, k),
    poleL: lerp3(a.poleL, b.poleL, k),
    wristR: lerp3(a.wristR, b.wristR, k),
    poleR: lerp3(a.poleR, b.poleR, k),
    propAt: lerp3(a.propAt, b.propAt, k),
    mouse: lerp3(a.mouse, b.mouse, k),
    pad: lerp(a.pad, b.pad, k),
    phone: lerp(a.phone, b.phone, k),
    shake: lerp(a.shake, b.shake, k),
  };
}

const smooth = (k: number) => k * k * (3 - 2 * k);
const accel = (k: number) => k * k;
const decel = (k: number) => 1 - (1 - k) * (1 - k);

type Frame = { at: number; ease: (k: number) => number; pose: Pose };

/**
 * Sample a keyframe track at `p` seconds, holding the ends. Always a fresh
 * pose — callers layer on top of the result, and the keyframes themselves are
 * module constants that must survive being played more than once.
 */
function track(frames: Frame[], p: number): Pose {
  if (p <= frames[0].at) {
    return { ...frames[0].pose };
  }
  for (let i = 1; i < frames.length; i += 1) {
    if (p <= frames[i].at) {
      const a = frames[i - 1];
      const b = frames[i];
      return mixPose(
        a.pose,
        b.pose,
        b.ease((p - a.at) / Math.max(1e-6, b.at - a.at)),
      );
    }
  }
  return { ...frames[frames.length - 1].pose };
}

/* ---- typing, one hand on the mouse: the resting activity ---- */
function poseKeys(p: number, t: number): Pose {
  const mouse: Vec3 = [
    Math.sin(t * 1.3) * 0.025,
    0,
    Math.sin(t * 0.9) * 0.04,
  ];
  return makePose({
    lean: Math.sin(t * 1.4) * 0.012,
    look: [SCREEN_MID[0], SCREEN_MID[1] + Math.sin(t * 2.3) * 0.17, Math.sin(t * 1.9) * 0.1],
    // The tapping hand: a fast bob, never below the keys.
    wristL: [wristL[0], wristL[1] + Math.abs(Math.sin(t * 13)) * 0.03, wristL[2]],
    wristR: add(wristR, mouse),
    mouse,
  });
}

/* ---- controller, sat back from the desk ---- */
function posePad(p: number, t: number): Pose {
  const drift: Vec3 = [
    Math.sin(t * 1.7) * 0.006,
    Math.sin(t * 2.2) * 0.007,
    Math.sin(t * 1.3) * 0.008,
  ];
  // Thumbs working the sticks, out of phase so the hands are never in step.
  const thumbL = Math.sin(t * 6.5) * 0.011;
  const thumbR = Math.sin(t * 5.1 + 1) * 0.011;
  return makePose({
    lean: -0.1 + Math.sin(t * 1.1) * 0.02,
    look: [
      SCREEN_MID[0],
      SCREEN_MID[1] + Math.sin(t * 1.7) * 0.13,
      Math.sin(t * 0.8) * 0.16,
    ],
    wristL: add([0.78, 0.95 + thumbL, -0.17], drift),
    poleL: [-0.35, -1, -0.55],
    wristR: add([0.79, 0.95 + thumbR, 0.21], drift),
    poleR: [-0.35, -1, 0.55],
    propAt: drift,
    pad: 1,
  });
}

/* ---- phone, held upright, thumbed with the other hand ---- */
function posePhone(p: number, t: number): Pose {
  const drift: Vec3 = [
    Math.sin(t * 0.9) * 0.006,
    Math.sin(t * 1.3) * 0.008,
    Math.sin(t * 1.1) * 0.005,
  ];
  // Taps land on the screen and travel around it between taps.
  const tap = Math.pow(Math.abs(Math.sin(t * 3.4)), 3);
  const roam: Vec3 = [0, Math.sin(t * 0.8) * 0.045, Math.sin(t * 1.15) * 0.05];
  return makePose({
    lean: -0.06,
    // Held below eye level, so the head comes down to it — about 32 degrees
    // off the monitor, which is what makes the activity read at a glance.
    look: [0.85, 1.33, 0],
    wristL: add([0.72, 1.1, -0.05], drift),
    poleL: [0, -1, -0.4],
    wristR: add(add([0.762, 1.176, 0.139], drift), add(roam, [tap * 0.022, 0, 0])),
    poleR: [0, -1, 0.5],
    propAt: drift,
    phone: 1,
  });
}

/* ---- losing it: both palms into the desk, twice ---- */
const SLAM_L: Vec3 = [1.04, 0.755, -0.55];
const SLAM_R: Vec3 = [1.07, 0.755, 0.55];
const SLAM_POLE_L: Vec3 = [-0.3, -1, -0.6];
const SLAM_POLE_R: Vec3 = [-0.3, -1, 0.6];
const DESK_LOOK: Vec3 = [1.25, 0.66, 0];

const slamPose = (y: number, lean: number) =>
  makePose({
    lean,
    look: DESK_LOOK,
    wristL: [SLAM_L[0], y, SLAM_L[2]],
    poleL: SLAM_POLE_L,
    wristR: [SLAM_R[0], y, SLAM_R[2]],
    poleR: SLAM_POLE_R,
  });

const RAGE: Frame[] = [
  { at: 0, ease: smooth, pose: makePose({}) },
  {
    // fists up, chair-back, chin up: the wind-up
    at: 0.3,
    ease: decel,
    pose: makePose({
      lean: -0.13,
      look: [1.35, 2.05, 0],
      wristL: [0.72, 1.3, -0.3],
      poleL: [-0.2, -1, -0.5],
      wristR: [0.75, 1.3, 0.32],
      poleR: [-0.2, -1, 0.5],
    }),
  },
  { at: 0.42, ease: accel, pose: slamPose(0.755, 0.18) },
  { at: 0.58, ease: decel, pose: slamPose(0.775, 0.16) },
  {
    at: 0.86,
    ease: decel,
    pose: makePose({
      lean: -0.06,
      look: [1.3, 1.9, 0],
      wristL: [0.8, 1.16, -0.34],
      poleL: [-0.25, -1, -0.55],
      wristR: [0.83, 1.16, 0.36],
      poleR: [-0.25, -1, 0.55],
    }),
  },
  { at: 0.98, ease: accel, pose: slamPose(0.755, 0.18) },
  { at: 1.14, ease: decel, pose: slamPose(0.775, 0.16) },
  // seething, hands still flat on the desk, then back to work
  { at: 1.72, ease: smooth, pose: slamPose(0.79, 0.11) },
  { at: 2.4, ease: smooth, pose: makePose({ lean: 0.02 }) },
  { at: 2.95, ease: smooth, pose: makePose({}) },
];

const IMPACTS = [0.42, 0.98];

function poseRage(p: number, t: number): Pose {
  const base = track(RAGE, p);
  // Impact energy decays over about half a second; two hits can overlap.
  let shake = 0;
  for (const hit of IMPACTS) {
    if (p > hit) {
      shake += Math.exp((hit - p) * 7);
    }
  }
  base.shake = Math.min(1, shake);
  // Breathing hard on the way down from it, ramped in over half a second so
  // the sine does not appear mid-swing and pop the torso.
  base.lean += Math.sin(t * 4.6) * 0.014 * clamp((p - 1.7) * 2, 0, 1);
  return base;
}

type Activity = {
  pose: (p: number, t: number) => Pose;
  /** How long it runs, seconds. */
  dwell: () => number;
  /** How long the crossfade into it takes. */
  fade: number;
};

const ACTIVITIES: Record<string, Activity> = {
  keys: { pose: poseKeys, dwell: () => 6.5 + Math.random() * 4, fade: 0.5 },
  pad: { pose: posePad, dwell: () => 8.5 + Math.random() * 3, fade: 0.6 },
  phone: { pose: posePhone, dwell: () => 8.5 + Math.random() * 3, fade: 0.6 },
  // Snaps in — nobody eases into losing their temper — and the track itself
  // is 2.95s long, so the dwell only has to outlast it.
  rage: { pose: poseRage, dwell: () => 3.4, fade: 0.16 },
};

const BREAKS = ["pad", "phone", "rage"];

/**
 * Always back to the keyboard between activities: it is the resting pose, it
 * gives every transition the same endpoints, and it means the outburst erupts
 * out of ordinary typing rather than out of nowhere.
 */
function nextActivity(current: string): string {
  if (current !== "keys") {
    return "keys";
  }
  return BREAKS[Math.floor(Math.random() * BREAKS.length)];
}

/** Build the frame's transforms from a pose. */
function rigFor(pose: Pose): Record<string, Xform> {
  const torsoM = rotZ(-pose.lean); // +X is forward, so forward lean is -Z
  const torso: Xform = { m: torsoM, from: HIP, to: HIP };

  const eyes = apply(torso, EYES);
  const headM = matMul(
    align(matVec(torsoM, REST_LOOK), sub(pose.look, eyes)),
    torsoM,
  );
  const head: Xform = { m: headM, from: NECK, to: apply(torso, NECK) };

  const arm = (
    shoulder: Vec3,
    elbowRest: Vec3,
    wristRest: Vec3,
    l1: number,
    l2: number,
    target: Vec3,
    pole: Vec3,
  ) => {
    const s = apply(torso, shoulder);
    const elbow = solveElbow(s, target, l1, l2, pole);
    const upper: Xform = {
      m: align(sub(elbowRest, shoulder), sub(elbow, s)),
      from: shoulder,
      to: s,
    };
    const fore: Xform = {
      m: align(sub(wristRest, elbowRest), sub(target, elbow)),
      from: elbowRest,
      to: elbow,
    };
    // The hand rides the forearm: as an affine map that is the same transform,
    // since the forearm already carries the wrist to where the hand starts.
    return { upper, fore };
  };

  const left = arm(
    shoulderL,
    elbowL,
    wristL,
    BONE.upperL,
    BONE.foreL,
    pose.wristL,
    pose.poleL,
  );
  const right = arm(
    shoulderR,
    elbowR,
    wristR,
    BONE.upperR,
    BONE.foreR,
    pose.wristR,
    pose.poleR,
  );

  // Things resting on the desk hop when it is hit.
  const hop = pose.shake * Math.abs(Math.sin(pose.shake * 34)) * 0.03;
  const shift = (v: Vec3): Xform => ({ m: IDENTITY, from: ORIGIN, to: v });

  return {
    torso,
    head,
    armL: left.upper,
    foreL: left.fore,
    handL: left.fore,
    armR: right.upper,
    foreR: right.fore,
    handR: right.fore,
    mouse: shift([pose.mouse[0], pose.mouse[1] + hop, pose.mouse[2]]),
    keyboard: shift([0, hop, 0]),
    pad: shift(pose.propAt),
    phone: shift(pose.propAt),
  };
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
    let scale = 1;

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      // Height-limited on desktop, width-limited on phones. The divisors carry
      // headroom for the worst rotation angle, not just the resting one: the
      // scene is widest on screen around 60-70 degrees of spin, where the far
      // desk corners swing out and perspective is still magnifying them.
      scale = Math.min(width / 4.0, height / 3.75);
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

      const persp = FOCAL / (CAM_DIST - z2);

      return {
        x: width / 2 + x1 * persp * scale,
        y: height / 2 - y2 * persp * scale - FRAME_LIFT * scale,
        z: z2,
      };
    }

    type Point = { x: number; y: number; z: number };

    /** Farther geometry is dimmer and thinner — the only depth cue needed. */
    function depth(z: number) {
      return Math.min(1, Math.max(0, (z + 2.2) / 4.4));
    }

    /** Stroke a set of edges bucketed far-to-near, one path per band. */
    function strokeBands(list: [number, number][], at: Point[], fade: number) {
      const paths = Array.from({ length: BUCKETS }, () => new Path2D());
      for (const [a, b] of list) {
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
        ctx!.globalAlpha = (0.07 + d * 0.4) * fade;
        ctx!.lineWidth = 0.5 + d * 0.85;
        ctx!.stroke(paths[i]);
      }
    }

    /** Fill a flat panel — the monitor, and the phone's face. */
    function fillPanel(
      corners: Vec3[],
      x: Xform | undefined,
      spin: number,
      tilt: number,
      alpha: number,
    ) {
      ctx!.beginPath();
      corners.forEach((p, i) => {
        const q = project(x ? apply(x, p) : p, spin, tilt);
        if (i === 0) {
          ctx!.moveTo(q.x, q.y);
        } else {
          ctx!.lineTo(q.x, q.y);
        }
      });
      ctx!.closePath();
      ctx!.fillStyle = acid;
      ctx!.globalAlpha = alpha;
      ctx!.fill();
    }

    function render(t: number, pose: Pose, spin: number, tilt: number) {
      ctx!.lineCap = "round";
      ctx!.lineJoin = "round";

      const rig = rigFor(pose);
      const at = verts.map((v, i) => {
        const x = rig[groups[i]];
        return project(x ? apply(x, v) : v, spin, tilt);
      });

      const flicker = 0.07 + Math.abs(Math.sin(t * 3.1)) * 0.09;
      fillPanel(SCREEN, undefined, spin, tilt, flicker);

      strokeBands(edges, at, 1);

      // Props are drawn only while they are in his hands. Skipped rather than
      // faded to nothing, because a zero-length round-capped line is a dot.
      if (pose.pad > 0.02) {
        strokeBands(propEdges.pad, at, pose.pad);
      }
      if (pose.phone > 0.02) {
        strokeBands(propEdges.phone, at, pose.phone);
        fillPanel(
          PHONE_SCREEN,
          rig.phone,
          spin,
          tilt,
          (0.12 + Math.abs(Math.sin(t * 5.7)) * 0.1) * pose.phone,
        );
      }

      // anatomical landmarks on top
      ctx!.fillStyle = acid;
      const dots = joints
        .flatMap((j) => {
          const vis =
            j.group === "pad"
              ? pose.pad
              : j.group === "phone"
                ? pose.phone
                : 1;
          if (vis <= 0.02) {
            return [];
          }
          const x = rig[j.group];
          return [{ p: project(x ? apply(x, j.at) : j.at, spin, tilt), r: j.r, vis }];
        })
        .sort((m, n) => m.p.z - n.p.z);

      for (const dot of dots) {
        const d = depth(dot.p.z);
        ctx!.globalAlpha = (0.35 + d * 0.65) * dot.vis;
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

    /* ---- activity state ---- */
    let from = "keys";
    let to = "keys";
    let mix = 1; // 0 = fully `from`, 1 = fully `to`
    let fromPhase = 0; // seconds each activity has been running
    let toPhase = 0;
    let holdFor = ACTIVITIES.keys.dwell();

    let frame = 0;
    let running = false;
    let prev = performance.now();

    function advance(dt: number) {
      fromPhase += dt;
      toPhase += dt;

      if (mix < 1) {
        mix = Math.min(1, mix + dt / ACTIVITIES[to].fade);
        if (mix === 1) {
          from = to;
          fromPhase = toPhase;
        }
        return;
      }

      if (toPhase >= holdFor) {
        from = to;
        fromPhase = toPhase;
        to = nextActivity(to);
        toPhase = 0;
        mix = 0;
        holdFor = ACTIVITIES[to].dwell();
      }
    }

    function currentPose(t: number): Pose {
      const b = ACTIVITIES[to].pose(toPhase, t);
      if (mix >= 1) {
        return b;
      }
      return mixPose(ACTIVITIES[from].pose(fromPhase, t), b, smooth(mix));
    }

    function draw(now: number) {
      const t = (now - start) / 1000;
      // The resting sway is part of the idle behaviour, so it fades out with it.
      const sway = reduced ? 0 : Math.sin(t * 0.33) * 0.07 * autoBlend;
      // Under reduced motion the loop still runs while the user drags, but the
      // body's involuntary motions stay frozen: only rotation they are actively
      // driving should move. Freezing the clock is what holds them still, and
      // it also pins the activity scheduler to the resting keyboard pose.
      const clock = reduced ? 0 : t;
      const pose = currentPose(clock);

      ctx!.clearRect(0, 0, width, height);
      if (pose.shake > 0.001) {
        // Hitting the desk kicks the camera. The vertical half is deliberately
        // one-sided — it only ever shoves the scene *down*. Dragged to
        // TILT_MAX the monitor already sits 0.014 units off the top of the
        // frame, so any upward kick clips it; downward there is 0.161 units of
        // margin in the tightest viewport shape, and this uses a third of it.
        // Scaled with the scene, so it is the same shove at any size.
        ctx!.save();
        ctx!.translate(
          Math.sin(clock * 37) * pose.shake * 0.03 * scale,
          (1 - Math.cos(clock * 44)) * 0.5 * pose.shake * 0.05 * scale,
        );
        render(clock, pose, spin, tilt + sway);
        ctx!.restore();
        return;
      }
      render(clock, pose, spin, tilt + sway);
    }

    function step(now: number) {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;

      if (!reduced) {
        advance(dt);
      }

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
      // ags-enter is the shared load-in: opacity and a translate on this
      // wrapper only. It changes no layout box, so the ResizeObserver below
      // never sees it and the canvas is unaffected.
      className="ags-enter relative h-[clamp(360px,min(88vh,95vw),1000px)] w-full cursor-grab touch-pan-y select-none [--ags-delay:220ms] active:cursor-grabbing lg:aspect-[16/15] lg:h-auto lg:max-h-[88vh]"
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
