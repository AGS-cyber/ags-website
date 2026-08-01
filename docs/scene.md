# The hero scene

`components/GamerScene.tsx` — a person seated at a desk, mid-session, rendered as a rotating 3D
wireframe on a canvas. It is the largest single piece of code in the project.

**No 3D library.** The scene is 493 vertices and 693 edges, plus 66 more that belong to props
and are only drawn when one is in his hands; a WebGL dependency would cost more bundle than the
entire rest of the site. The projection is about fifteen lines of matrix maths.

He does not only type. An [activity scheduler](#activities) cycles him through the keyboard,
a controller, a phone and the occasional loss of composure, driven by [a rig](#the-rig) rather
than by hardcoded vertex offsets.

## Geometry

The body is **not** a stick figure. It is a mesh generated procedurally from an anatomical
skeleton at module load:

- **Torso** — seven lofted elliptical cross-sections: hips wide, waist pinched, chest broad,
  shoulders broadest, tapering into the neck. Each section is deeper front-to-back than
  side-to-side, so it reads as a body rather than a tube.
- **Skull** — seven stacked rings plus a crown vertex.
- **Limbs** — tapered tubes swept along each bone. Rings are generated *perpendicular to the
  bone direction* via an orthonormal basis, so they stay circular at any angle.
- **Hands** — a palm tube plus four individual fingers each, tips resting on the keys and
  curled over the mouse.
- **Furniture** — desk slab with thickness, monitor box with front and back panels, chair with
  seat, back panel and a five-spoke base.
- **Props** — a gamepad and an upright phone, each modelled *where it is actually held* rather
  than in the rest hand. The pose that uses one places the wrists around it by design, so
  authoring them in place is what makes the grip line up.

Posture is a gamer's: pelvis back, shoulders forward, head craned at the screen. That is the
**rest pose**, and every activity is written as a departure from it.

### Prop edges are kept separate

`propEdges` holds the pad's and the phone's edges outside the main list, so a hidden prop costs
nothing to skip. It has to be a skip rather than a zero alpha: `lineCap: "round"` paints a dot
for a zero-length line, so a prop collapsed to a point would leave a stray speck behind. Their
landmarks are gated the same way, and both fade with the crossfade rather than popping.

### Two visual layers

The mesh gives human structure. On top, about 24 **anatomical landmarks** (shoulders, elbows,
wrists, knuckles, hips, knees, ankles, crown) draw as dots. That second layer is what keeps the
scene looking like this site rather than like an imported 3D model. Keep both.

### Builder helpers

`section()` makes a horizontal elliptical ring; `stack()` lofts a list of them; `ringAt()` and
`tube()` handle arbitrary-angle limbs; `quad()` makes flat panels and `slab()` bridges two of
them into a box. Vertices are tagged with a `group` string as they are pushed, which is how the
rig finds them later. There are thirteen groups: `torso`, `head`, the six arm segments,
`mouse`, `keyboard`, `pad`, `phone`, and `static` for everything that never moves.

## The rig

Each animated group gets **one affine map**, `p -> to + m * (p - from)`, rebuilt every frame by
`rigFor()`. There is no scene graph and no per-joint orientation state; the poses are shallow
enough that composing the three or four transforms explicitly is clearer than a hierarchy.

Arms are posed by **two-bone IK**. A pose says where the wrist goes and `solveElbow()` finds the
elbow, given a *pole* hint for which way the elbow bulges. Bones keep their rest length by
construction, so an unreachable target straightens the arm instead of stretching it — the reach
is clamped just inside full extension, because a straight arm has no defined elbow plane.

The rotations come from `align()`, the shortest rotation taking one direction onto another
(Rodrigues). Twist about the bone's own axis is left alone: it is invisible on a near-circular
tube and saves carrying a full orientation per joint. The hand needs no transform of its own —
as an affine map it is identical to the forearm's, because the forearm already carries the wrist
to where the hand starts.

**The default pole is the rest pose's own elbow direction**, recovered from the modelled
skeleton by `restPole()`. Feeding it back in is what makes the solver reproduce the modelled
pose *exactly* rather than approximately: with no activity asking for anything else, the
keyboard pose renders pixel-for-pixel as it did before there was a rig. That is the regression
test — if the resting frame ever changes, something in the rig has drifted.

The head aims rather than rotating by a set angle: a pose gives a **point to look at**, and the
head takes the shortest rotation from its rest aim (the middle of the monitor) to the new one.
Aim is measured from the eyes, not from the neck pivot it rotates about, so "look at the phone"
produces the bow you would expect rather than a shrug.

## Activities

| Activity | What it is | Dwell |
| -------- | ---------- | ----- |
| `keys`   | typing, one hand on the mouse — the rest pose | 6.5–10.5s |
| `pad`    | controller in both hands, sat back from the desk, thumbs on the sticks | 8.5–11.5s |
| `phone`  | phone held upright in the left hand, thumbed with the right, head bowed | 8.5–11.5s |
| `rage`   | both palms into the desk, twice | 3.4s |

**Always back to `keys` between activities.** It is the resting pose, it gives every transition
the same endpoints, and it means the outburst erupts out of ordinary typing rather than out of
nowhere. Which break comes next is a uniform pick from the other three.

A `Pose` is a flat bag of numbers and points — lean, look target, both wrists and poles, prop
drift, mouse drift, two prop opacities and an impact energy. Everything in it lerps, so
crossfading between activities is one `mixPose()` call. Activities crossfade over 0.5–0.6s;
`rage` snaps in over 0.16s, because nobody eases into losing their temper.

`rage` is the only one with an internal timeline: a keyframe track (`RAGE`) sampled by
`track()`, with per-segment easing — `accel` into each slam, `decel` out of it. Wind-up at
0.3s, slam at 0.42s, a second, smaller lift at 0.86s, slam again at 0.98s, then it hunches over
the desk and settles back to typing by 2.95s. `track()` always returns a *fresh* pose, because
the keyframes are module constants that get played more than once and callers layer on top of
the result.

### Impact

`shake` is not an event, it is a field: `exp(-7t)` from each impact time, summed. That makes it
blend like everything else and stay frame-rate independent. It drives two things — the keyboard
and mouse hop on the desk, and the camera takes a kick.

**The camera kick is one-sided on purpose, and this is load-bearing.** Dragged to `TILT_MAX` the
monitor already sits **0.014 scene units** off the top of the frame; downward there is **0.161**
in the tightest viewport shape (the height-bound one, where `scale = height / 3.75`). A
symmetric kick therefore cannot fit — the first version used ±0.045 and clipped the top of the
monitor on 22 frames out of 1200 at full tilt. The vertical term is now `(1 - cos) / 2`, which
is never negative, at 0.05 — about a third of the margin that actually exists. Horizontal is
±0.03 against a worst case of 0.255.

## Projection

```
rotate about CENTRE by spin (Y axis)
  → tilt (X axis)
    → perspective divide: FOCAL / (CAM_DIST - z)
      → scale, then offset by FRAME_LIFT
```

| Constant     | Value  | Purpose                                                     |
| ------------ | ------ | ----------------------------------------------------------- |
| `CAM_DIST`   | `6.5`  | camera distance from scene centre                            |
| `FOCAL`      | `6.5`  | focal length — equal to `CAM_DIST` puts `persp ≈ 1` at `z=0` |
| `FRAME_LIFT` | `0.26` | lifts framing without moving the rotation pivot              |

`FRAME_LIFT` exists because the camera tilt pushes near-side geometry (chair feet, desk legs)
downward. A scene centred on its own midpoint sits low and clips along the bottom edge.

### Scale, and why the divisors are what they are

```ts
const scale = Math.min(width / 4.0, height / 3.75);
```

Those divisors carry headroom for the **worst rotation angle, not the resting one.** The scene
is widest on screen around 60–70° of spin, where the far desk corners swing out while
perspective is still magnifying them. Measured at the resting frame the scene fills ~75–80% of
its box; the remaining space is that headroom.

Tightening `4.0` toward `3.6` buys roughly 11% more size and removes the margin that stops the
desk clipping at the widest spin. It was deliberately added after finding that case. Don't
undo it without re-measuring across a full rotation.

The container takes a **16:15 aspect** at `lg`, which is precisely where the width and height
limits meet — any other shape leaves one axis binding early and wastes the other.

### Depth

`depth(z)` maps `z` to `0…1`. Farther geometry is dimmer and thinner; that alpha falloff is the
only depth cue, and it does the work that a real renderer would do with occlusion.

## Rendering

Edges are bucketed into **12 depth bands**, each accumulated into one `Path2D` and stroked
once. That turns ~700 lines into a dozen canvas state changes rather than seven hundred.
`strokeBands()` does one pass over the main edges, then one more per visible prop, scaled by
that prop's opacity.

Measured cost: **0.151 ms/frame** for the *entire* draw — rig, projection, strokes and
landmarks — at 727×634 CSS px, averaged over 600 frames driven through a stepped clock. That is
about **110× headroom** against the 16.7 ms 60fps budget. The rig added no measurable cost: an
affine map per group and one 3×3 multiply per vertex disappears next to the canvas work.

Landmarks draw last, depth-sorted, on top.

## Interaction

Drag to orbit: horizontal spins, vertical tilts. Pointer events, so mouse, touch and pen all
work.

| Constant       | Value   | Meaning                                     |
| -------------- | ------- | ------------------------------------------- |
| `AUTO_RATE`    | `0.26`  | idle rotation, radians/sec                  |
| `IDLE_RESUME`  | `1.5`   | seconds untouched before idle spin fades in |
| `DRAG_SPIN`    | `0.008` | radians of spin per pixel dragged           |
| `DRAG_TILT`    | `0.004` | radians of tilt per pixel                   |
| `TILT_MIN/MAX` | `-0.2` / `0.6` | clamp — never edge-on or upside down |
| `MAX_FLING`    | `6`     | caps flung velocity so a fast swipe can't blur |

Release carries inertia, decaying frame-rate-independently
(`velocity *= Math.pow(0.93, dt * 60)`) so it feels identical at 60Hz and 144Hz. A pointer held
still for >120ms before release does not fling. Idle rotation eases back in rather than
snapping.

To stop it auto-rotating entirely, delete the `spin += AUTO_RATE * autoBlend * dt` line.

### Three things that are load-bearing

1. **`touch-action: pan-y`.** Vertical swipes scroll the page, horizontal drags rotate. Without
   it, a full-width band traps the page on mobile.

2. **`setPointerCapture` is called *last* and wrapped in `try`.** It once sat above the
   hint-dismiss and `ensureLoop()` calls; when it threw, the handler died halfway with
   `dragging` already `true` and **no render loop running** — the scene froze mid-gesture.
   Capture is an enhancement, not a requirement. Keep it last.

3. **One frame is painted synchronously on mount**, before the rAF loop starts.
   `requestAnimationFrame` does not fire in a hidden document, so without it the panel is blank
   for anyone who opens the site in a background tab until they first look at it.

### Reduced motion

No idle spin, no involuntary body motion, no flicker, and **no activity cycling** — `advance()`
is never called, so he stays at the keyboard. Dragging still works — user-initiated motion is
fine — and the loop stops itself once inertia dies rather than burning frames on a still image.
The render clock is frozen at `t = 0` in that mode, which is what holds the head bob and hand
tapping still while the user rotates, and pins the scheduler to `poseKeys(0, 0)`.

Verified: at mount the loop is never registered, the single painted frame is the resting pose
byte-for-byte, a drag starts the loop, and release stops it again once inertia decays.

## Testing it

`ResizeObserver` and `requestAnimationFrame` are both suspended in a hidden document, so an
automated browser running offscreen will show a stale canvas after a resize and never animate.
Reload after resizing rather than trusting a live resize, and verify by reading canvas pixels
(ink bounds, clipping, fill percentage) rather than by screenshot.

A stale canvas is easy to mistake for a real measurement. Assert it is fresh first:
`canvas.width === round(rect.width * dpr)`. Otherwise the pane has been resized without a
redraw and every pixel you read describes a layout that no longer exists.

Three levers make the scene testable without shipping any hooks for it:

- **Drive the clock.** Replace `requestAnimationFrame` with a manual pump, then remount the
  scene with a client-side navigation (`/reviews` and back — no reload, so the patch survives).
  The effect then registers with the patched rAF and you can step frames at any rate. Pump at
  **50 ms** steps: that is exactly the `dt` clamp, so the scheduler and the render clock advance
  together instead of drifting apart.
- **Pin the schedule.** The scheduler picks its next break with `Math.random`; overriding it
  with a constant makes any one activity reproducible. `0.1` → `pad`, `0.4` → `phone`,
  `0.9` → `rage`.
- **Freeze the framing.** Dispatch a `pointerdown` and never release. Auto-rotation is gated on
  `!dragging`, so the spin stays put and every captured frame shares one framing; `pointermove`
  then steps the spin by an exact amount per frame.

Clipping is the thing worth re-measuring after any change to pose or framing: read the four
2px border strips of the canvas and require **zero** ink. The current pose set was cleared over
4500 frames — three tilts including both clamp extremes, three activity schedules, ~180 full
rotations, in the height-bound viewport shape where the vertical margins are tightest. One
passing frame proves nothing; the worst case is a particular pose at a particular angle.
