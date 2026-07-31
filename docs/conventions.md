# Conventions

This document is the authoritative rulebook for the project: how the error-handling policy
applies here, plus the running list of sanctioned exceptions.

## Fail loud, never fake

Priority order, worst last:

1. Works correctly with real data
2. Falls back **visibly** — clearly signals degraded mode
3. Fails with a clear error message
4. Silently degrades to look "fine" — never do this

### Content is data

`lib/reviews.ts` reads `content/reviews/*.mdx` at build time. A missing directory, an
unparseable file or absent frontmatter should be a **build failure**, not an empty list. A
review index that renders happily with nothing in it is priority 4 wearing a smile: the build
goes green, the deploy succeeds, and the site is simply blank.

### Never invent the owner's facts

`hoursWasted`, the handle's history and anything biographical are real claims about a real
person on their own site. **If a value is unknown, ask.** A plausible-looking number is worse
than a missing one, because nobody will ever catch it.

This has already gone wrong once. Generated copy claimed the owner had used the handle *"since
I was eleven, on a forum that no longer exists"* — both details fabricated. The current copy
says only what is actually known: *"since I was very young."*

Placeholder data presented as real is the same failure mode as a swallowed exception.

## Sanctioned `catch` blocks

Empty catch blocks are permitted **only** for genuinely optional browser capabilities, and
**only** with a comment saying what degrades and why that is acceptable. This is the complete
list. If you add one, add it here too.

| Location                       | Swallows                            | What degrades                                          |
| ------------------------------ | ----------------------------------- | ------------------------------------------------------ |
| `BootSequence.tsx`             | `sessionStorage.getItem`            | Storage blocked (private mode) — boot sequence replays  |
| `BootSequence.tsx`             | `sessionStorage.setItem`            | Same; non-fatal                                        |
| `GamerScene.tsx`               | `wrap.setPointerCapture`            | Drag still works while the pointer stays over the scene |
| `GamerScene.tsx`               | `releasePointerCapture`             | Capture was never taken or already gone                 |

All four are decorative browser capabilities where the fallback is genuinely equivalent for the
user. None of them hide a data or correctness problem.

## Content validation

`lib/reviews.ts` treats bad content as a build failure. Every one of these throws:

| Condition                                            | Thrown by             |
| ---------------------------------------------------- | --------------------- |
| `content/reviews/` missing                            | `reviewFilenames()`   |
| directory present but holding no `.mdx` files         | `reviewFilenames()`   |
| a required frontmatter field absent                   | `parseReviewFile()`   |
| `score`, `year` or `hoursWasted` not a number         | `parseReviewFile()`   |
| `slug` disagreeing with its filename                  | `parseReviewFile()`   |

Errors name the offending file and field, so a failed build says which review is wrong.

Without this, a missing directory or a typo'd field would build **successfully** and produce a
site with an empty index, `0 GAMES REVIEWED`, `0` hours and an average score of `0` — priority
4 exactly. A malformed `score` used to reach the badge and the average as `NaN`.

`getReview()` returning `null` for an unknown slug is not a violation: that is a real 404.

## Known violations

None currently. Record them here rather than hiding them.

## Layout

**Fix causes, not symptoms.** Clipping, overflow and misalignment get fixed where they
originate. Do not reach for `overflow: hidden` to hide a symptom.

There is one `overflow-hidden` on the hero section. It is intentional — it bounds the scene
band — and it is not covering a layout bug.

Alignment comes from every band sharing `.shell`. Do not introduce a competing container; see
[design-system.md](design-system.md#layout-the-shell).

## Accessibility

- **Decorative things are hidden.** `GamerScene` and `Scanlines` carry `aria-hidden`. The scene
  is pointer-driven and not focusable — it conveys no information, so nothing is lost.
- **Heading outlines stay valid.** `ReviewCard` takes a `headingLevel` prop because the index
  puts cards under an `h1` and the home page nests them under a section `h2`. A hardcoded level
  would skip a heading level on one of the two pages. Verified: `/reviews` reads `H1 → H2×n`,
  home reads `H1 → H2 → H2 → H3×n`.
- **Contrast** is measured, not assumed. See
  [design-system.md](design-system.md#contrast).
- **Reduced motion** is honoured globally in CSS and explicitly in every JS-driven animation.

## Verification

**Do not report work as done on unverified claims.**

- `npm run build` and `npm run lint` must both exit 0.
- Layout and rendering claims need **measurement, not inspection**. Query the DOM, read canvas
  pixels, compute contrast. "It looks right" is not a result.
- Say plainly what could not be verified and why.

### Traps found the hard way

- **Parsing computed colours with a regex is wrong.** Tailwind emits `oklab(...)`; grabbing the
  first three numbers as RGB produces nonsense (it once reported a 1.04:1 contrast ratio for
  perfectly legible text). Composite through a canvas and read the pixel back.
- **A hidden browser suspends `requestAnimationFrame` and `ResizeObserver`.** Canvas content and
  canvas dimensions both go stale after a resize. Reload rather than trusting a live resize.
- **Dev-server console errors are cumulative per tab** and survive navigation and server
  restarts. An error quoting code that no longer exists is stale. `npm run build` is the live
  signal.
- **One passing frame is not proof for an animated thing.** The scene's worst case is a
  particular rotation angle, not the resting pose.
