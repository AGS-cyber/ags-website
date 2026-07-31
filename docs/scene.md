# The hero scene

`components/GamerScene.tsx` — a person seated at a desk, mid-session, rendered as a rotating 3D
wireframe on a canvas. It is the largest single piece of code in the project.

**No 3D library.** The scene is roughly 400 vertices and 700 edges; a WebGL dependency would
cost more bundle than the entire rest of the site. The projection is about fifteen lines of
matrix maths.

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

Posture is a gamer's: pelvis back, shoulders forward, head craned at the screen.

### Two visual layers

The mesh gives human structure. On top, about 24 **anatomical landmarks** (shoulders, elbows,
wrists, knuckles, hips, knees, ankles, crown) draw as dots. That second layer is what keeps the
scene looking like this site rather than like an imported 3D model. Keep both.

### Builder helpers

`section()` makes a horizontal elliptical ring; `stack()` lofts a list of them; `ringAt()` and
`tube()` handle arbitrary-angle limbs; `quad()` makes flat panels. Vertices are tagged with a
`group` string as they are pushed, which is how per-part animation works later.

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

Measured cost: **0.15 ms/frame** for the stroke work at full desktop size — about **113×
headroom** against the 16.7 ms 60fps budget, using random full-canvas lines which are longer
than the real scene's.

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

No idle spin, no involuntary body motion, no flicker. Dragging still works — user-initiated
motion is fine — and the loop stops itself once inertia dies rather than burning frames on a
still image. The render clock is frozen at `t = 0` in that mode, which is what holds the head
bob and hand tapping still while the user rotates.

## Testing it

`ResizeObserver` and `requestAnimationFrame` are both suspended in a hidden document, so an
automated browser running offscreen will show a stale canvas after a resize and never animate.
Reload after resizing rather than trusting a live resize, and verify by reading canvas pixels
(ink bounds, clipping, fill percentage) rather than by screenshot.
