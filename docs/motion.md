# Motion

Everything that moves on this site, and the two rules that keep it from breaking the page.

The scene has its own document — see [scene.md](scene.md). This one covers the rest: page
entrances, scroll reveals, hover states, the boot overlay handoff and the reading-progress
hairline. All of it lives in the motion section of `app/globals.css`.

## The two rules

### 1. No animation is load-bearing

Every animation ends at the state the page would have been in without it, and every entrance
is declared with `both` fill, so the element is at its final state before and after the
animation regardless of when it runs. Nothing on this site is hidden by CSS while it waits for
JavaScript to reveal it.

That rules out the usual `IntersectionObserver` reveal, where elements ship with `opacity: 0`
and a script adds a class. It looks identical when it works. When the bundle fails, the
hydration throws, or the observer never fires, the page is blank — and it is blank *quietly*,
which is priority 4 in [conventions.md](conventions.md). Scroll-driven CSS has no such failure
mode: browsers that do not support it simply paint the finished page.

The one JavaScript-dependent piece is the boot handoff below, and it is written so that the
attribute it relies on can only exist while the overlay that justifies it is on screen.

### 2. Scroll-driven animation opts out of reduced motion explicitly

`globals.css` ends with a global `prefers-reduced-motion: reduce` block that zeroes
`animation-duration` and `transition-duration`. Every time-based animation inherits that for
free.

**It does nothing to a scroll-driven animation.** Progress on a `view()` or `scroll()` timeline
comes from scroll position, not from elapsed time, so a duration of `0.01ms` changes nothing.
Every scroll-driven rule is therefore wrapped in `@media (prefers-reduced-motion:
no-preference)` as well as `@supports (animation-timeline: view())`. Under reduced motion the
rules do not exist at all, and the page renders settled.

Verified: with reduced motion emulated, 19 animated elements measured at scroll offset 0, none
faded, none on a scroll timeline.

## What moves

| Thing | Class | Driven by |
| --- | --- | --- |
| Hero, page headings, back link, scene | `.ags-enter` | Time, staggered by `--ags-delay` |
| The page body on every route change | `.ags-page` | Time, replayed by a remount |
| Sections, cards, pull-quotes, footer | `.ags-reveal` | `view()` timeline |
| The four stat tiles | `.ags-stat-tile` | The band's shared `view()` timeline |
| Reading progress hairline in the nav | `.ags-progress` | `scroll(root)` timeline |
| CRT scanlines | `.ags-scanlines` | Time, 9s loop |
| Boot lines, achievement toast | `.ags-boot-line`, `.ags-toast` | Time, on mount |
| Hover states | `.ags-cta`, `.ags-card`, `.ags-underline`, `.ags-shift` | Transition |

Two easings and two durations, defined once as custom properties. Entrances decelerate hard
(`--ease-enter`) because they are over quickly; scroll reveals use a gentler curve
(`--ease-scroll`) because the user controls the clock by scrolling, and a curve that
front-loads 90% of the movement into the first fifth reads as a jump rather than a glide.

## Traps found the hard way

### An `entry` range is only as long as the element is tall

The first version of `.ags-reveal` used `animation-range: entry 10% entry 60%`. On a review
card that is about 40px of scroll — measured at 0.97 opacity 40px in, so the fade was over
before it could be read as motion at all.

### A range that ends after "fully visible" never completes at the bottom of the page

The fix for the above was `cover 0% cover 28%`, which is longer and looks better in the middle
of a page. It also left the footer **permanently at 0.585 opacity**: `cover 28%` is a scroll
position roughly a third of a screen past the point where the footer is fully visible, and you
cannot scroll past the end of the document, so that position does not exist. The element just
sits there, faded, forever.

This is the exact failure the "no animation is load-bearing" rule exists to prevent, and it
still got in — because it only shows up in the last screenful of a page, and only if you look
at the opacity rather than the page.

`.ags-reveal` now uses `entry 0% contain 0%`: it finishes the moment the element is fully on
screen, which is the last position every element can actually reach. The reveal then spans
exactly the element's own height in scroll — 160px for a review card, which is longer than a
typical 100px wheel tick, so it still reads as motion.

The stat tiles keep `cover`-based ranges to get their stagger. That is safe only because the
band has the about section, six review cards and a footer beneath it. **Do not copy that form
onto anything that can land in the last screenful of a page.**

### `overflow: hidden` makes an element a scrollport

A `view()` timeline resolves against the nearest scrollport ancestor, and `overflow: hidden`
creates one even though it never scrolls. Anything inside the hero band — which carries
`overflow-hidden` deliberately, to bound the scene — would have its progress pinned at a
constant. The hero uses time-based `.ags-enter` instead, which is what it wants anyway: it is
above the fold at every viewport, so there is no scroll to drive anything.

### The animation shorthand sets `animation-duration: 0s`

Scroll-driven rules set `animation-name`, `-fill-mode` and `-timing-function` as longhands on
purpose. The `animation` shorthand would reset `animation-duration` to `0s`, and these need it
to stay `auto` so the keyframes map onto the whole `animation-range`.

### Reconciliation can keep the DOM node across a route change

`PageTransition` keys `<main>` on the pathname. Without the key React reconciles the two pages'
markup in place wherever their shapes happen to match, the DOM nodes survive, and the entrance
animation never restarts — silently, on some routes and not others.

### `getBoundingClientRect()` includes the transform

An element at rest under `.ags-reveal` sits 20px below its layout box, because the animation's
first frame is `translateY(1.25rem)` and `both` fill holds it there. Measuring scroll positions
from that rect puts every offset 20px out. Subtract `DOMMatrixReadOnly(...).m42`, or read the
box before the class is applied.

## The boot handoff

The boot overlay owns the screen for its first two seconds, so the page's entrances would
otherwise play behind it and be finished before anyone saw them.

`BootSequence` sets `data-ags-booting` on `<html>`, and CSS holds `.ags-enter` and `.ags-page`
at `animation-play-state: paused` while it is there. The page then arrives *after* the boot
clears instead of behind it.

This is the one place where JavaScript can hide content, so it is arranged to be safe by
construction:

- The overlay is client-only — the server render returns `null` — so if the bundle never
  executes, the attribute is never set and nothing is ever paused.
- The attribute is set in the same effect that schedules the boot timers, and removed in that
  effect's cleanup, which React runs when the overlay is dismissed as well as on unmount.
- If a crash froze the attribute in place, the overlay would be frozen on screen too. There is
  no state where the page is paused and the reason for pausing it is invisible.

## Verifying it

Rendering claims need measurement (see [conventions.md](conventions.md)). Animation is worse
than static layout for this, because the state that matters is often mid-flight and the state
that is broken is often only reachable at one scroll offset on one viewport size.

The method: drive a headless browser over the DevTools Protocol, set the viewport with
`Page.setDeviceMetricsOverride`, emulate reduced motion with `Emulation.setEmulatedMedia`, and
read computed styles and `element.getAnimations()` at chosen scroll offsets. Scroll with
`behavior: "instant"` and settle across two `requestAnimationFrame` calls before sampling —
smooth scrolling puts the samples at offsets you did not choose. Dispatch hover with
`Input.dispatchMouseEvent`; a synthetic `mouseover` event does not set `:hover`.

The checks worth re-running after any change here:

| Check | Result |
| --- | --- |
| Every animated element reaches opacity 1 at max scroll, across 3 viewports × 4 routes | 135 elements, 0 left faded |
| Card reveal is gradual and finishes before mid-viewport | 160px of scroll on a 168px card, monotonic, 1.000 by mid-viewport |
| Stat tiles cascade rather than landing together | 0.999 > 0.951 > 0.742 > 0.254 mid-flight |
| Progress hairline maps scroll to width | 0px at top, 712.8px at 50%, 1425px of 1425px at the bottom |
| Route change replays the page entrance | Fresh `<main>` node, `ags-page-in` observed from `currentTime` 0 |
| Reduced motion renders the page settled | 19 elements, 0 faded, 0 on a scroll timeline |
| Boot overlay pauses entrances, then releases them | `paused` at opacity 0 during, opacity 1 after |
| Left edges still line up | Spread 0px across six bands |
| Accent budget unchanged | 11 acid elements on home, 3 in an article |
| Hover states respond | CTA `0%`→`100%`, underline `scaleX(0)`→`scaleX(1)`, card −2px, score +4px |
| Toast animates out before unmounting | `entering` → `leaving` → unmounted |
| Scene still paints | 47.5k ink pixels, wrapper box unchanged |

Two of those numbers are guard rails rather than aesthetics. The **left-edge spread** must stay
0 — see [design-system.md](design-system.md#layout-the-shell) — and transforms on cards and
tiles are the obvious way to break it. The **accent budget** must stay at 11 and 3; the
progress hairline is deliberately `--muted` and not `--acid` for that reason. Count with the
achievement toast excluded, or scrolling to the bottom to take the measurement summons it and
you will read 13.
