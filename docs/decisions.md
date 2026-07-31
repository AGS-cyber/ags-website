# Decisions

Why the site is the way it is, and what was deliberately rejected. Read this before
"simplifying" something.

## Product

**Zero is reachable.** The site began with every score negative and nothing able to reach `0`.
That is a purer joke and a worse review site: with no dynamic range, every entry reads as a
complaint and the numbers stop meaning anything. Making `0` rare but real gives the negatives
something to push against — a `-88` only lands because a `0` exists.

The cost is that the domain name becomes technically a lie. The about copy says so out loud,
which is funnier than hiding it.

**The scale is a bit; the criticism is not.** A game only appears if the author cared enough to
keep playing. This is the line that keeps the site from reading as bitter.

**No comments, no accounts, no database.** Adding a review is adding a file. This is the single
biggest reason the site will still be alive in a year — there is nothing to maintain, moderate
or migrate.

## Technical

**Hand-rolled 3D instead of Three.js.** ~400 vertices and ~700 edges. The library would have
outweighed the entire rest of the site; the projection is fifteen lines. See
[scene.md](scene.md).

**Canvas, not SVG, for the scene.** The first version was animated SVG with CSS keyframes —
elegant, no client JS, but flat. Real 3D needs per-frame recomputation of every vertex, which
is canvas work. The SVG keyframes were deleted rather than left to rot.

**One layout class rather than per-section arithmetic.** The hero originally aligned itself to
the content container with
`calc((100% - 64rem) / 2 + 1.5rem)`. That worked until it didn't:

- At 4K the gutter is half the viewport — 1432px — which marooned the wordmark mid-screen.
- Capping the same element that carried the percentage made it *worse*, because percentage
  padding resolves against the **containing block**, not the element's own width. The gutter
  computed against the full viewport inside a capped hero and crushed the scene to 24×22px.

`.shell` replaced all of it. Alignment is now true by construction, and the failure mode is
gone rather than patched.

**Static everything.** Four routes, all prerendered. Three client components, all decorative.

## Rejected

| Considered                               | Why not                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Light mode                               | Doubles CSS surface, fights the CRT aesthetic, nobody asked              |
| Three.js / WebGL                         | ~150KB for 400 vertices                                                  |
| A community/voting layer                  | Needs an audience first; an empty board looks dead                       |
| Serif editorial restyle                   | Considered for "elegant"; would have refined the character out of it     |
| Dropping the scanlines and toasts         | Offered and declined — the gimmicks are the personality                  |
| Widening the reading container at 4K      | Review cards 3000px wide are unreadable at any resolution                |
| Tightening the scene's `4.0` scale divisor | Buys ~11% size, reintroduces clipping at the widest rotation angle       |

## Things that look like mistakes but aren't

- **`AVERAGE SCORE` is meaningless.** One entry scores `-100000000000`, so the mean is `-16.7B`.
  This is the funniest thing on the front page and is left deliberately. It can be made useful
  by excluding off-scale entries.
- **The scene doesn't fill its box.** ~75–80% at rest is headroom for the widest rotation angle.
- **`@theme { --font-sans: initial; }`** is not dead code — it stops Tailwind's own font theme
  keys colliding with `next/font`'s variables.
- **Card markup is duplicated into `ReviewCard` with a `headingLevel` prop** rather than
  hardcoded, to keep both pages' heading outlines valid.
- **Arknights has zero hours.** It is a refusal, not a review, and its first line says so.
