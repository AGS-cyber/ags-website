# Design system

Dark only. There is no light mode and there never will be — a second theme doubles the CSS
surface and fights the CRT aesthetic for nothing.

## Tokens

CSS custom properties in `app/globals.css`, consumed through Tailwind arbitrary values
(`bg-[var(--surface)]`, `text-[var(--muted)]`).

| Token             | Value     | Used for                                        |
| ----------------- | --------- | ----------------------------------------------- |
| `--bg`            | `#08080a` | page background                                 |
| `--surface`       | `#0f0f13` | cards, stat band                                |
| `--border`        | `#1c1c22` | hairlines — there are no shadows anywhere        |
| `--border-bright` | `#2c2c35` | hover and deliberate emphasis only               |
| `--text`          | `#ededf0` | headings, card titles, stat numbers              |
| `--muted`         | `#8b8b95` | secondary copy, metadata, section labels         |
| `--acid`          | `#c6f000` | **accent only** — see the rule below             |
| `--warn`          | `#ff5c5c` | the two worst score bands                        |

### The accent rule

**Acid green is not a text colour.** It is reserved for exactly four things:

1. Scores (`ScoreBadge`)
2. Links and the primary call to action
3. Focus rings and `::selection`
4. The 3D scene

It is deliberately *not* used for section headings, nav items, stat numbers, MDX subheads or
list markers. Those all previously used it, which meant it accented nothing — when everything
is highlighted, nothing is.

Current usage, measured in the DOM: **11 acid elements on the home page** (the CTA plus six
scores and their labels) and **three** in an entire review article (the score, its label, and
the pull-quote's left rule). If a change pushes those numbers up meaningfully, something has
started shouting again.

## Typography

Both faces are self-hosted at build time by `next/font/google` — **no CDN requests at runtime.**

- **Inter** (`--font-sans`) — body copy
- **JetBrains Mono** (`--font-mono`, via the `mono` utility) — every number, label, nav item,
  score and button, uppercase

> Tailwind v4 ships its own `--font-sans` / `--font-mono` theme keys, which collide with
> `next/font`'s variables at equal specificity and resolve by stylesheet order. `globals.css`
> unsets both in `@theme` and owns the families explicitly through the `mono` utility. Do not
> "simplify" this back.

### Tracking is scale-aware

The single most important typographic rule here:

| Type                          | Tracking       |
| ----------------------------- | -------------- |
| Wordmark, headings, scores    | `0.01–0.02em`  |
| Small mono labels, nav, meta  | `0.18–0.22em`  |

Wide tracking flatters a 10px label and coarsens a 56px wordmark. Everything used to wear
`0.15em` regardless of size, which is why large type looked crude. Large type is tight; small
type is wide.

### Reading typography

- Prose: **18px / 1.8 line-height**, measure capped at **62ch**
- Card verdicts: 16px / 1.7, capped at 58ch
- Pull-quotes: 24px italic with a hairline acid left rule — no filled panel

### Contrast

Measured by compositing through a canvas (not by parsing computed colour strings — Tailwind
emits `oklab()`, which naive RGB parsing misreads badly):

| Element                              | Size     | Ratio     |
| ------------------------------------ | -------- | --------- |
| Body prose                           | 18px     | 12.35 : 1 |
| Card titles                          | 18px     | 17.13 : 1 |
| Muted text — lede, verdicts, nav, footer | 11–20px | 5.93 : 1  |

All pass WCAG AA with room to spare. Keep `--muted` at or above its current lightness.

## Layout: the shell

One class, used by **every** band on the site — nav, hero, stat band, about, review lists,
articles, 404, footer:

```css
.shell {
  margin-inline: auto;
  width: 100%;
  max-width: 110rem;
  padding-inline: clamp(1.25rem, 3.5vw, 4rem);
}
```

This is the whole layout system. Because every section uses the identical class, the left edge
lines up **by construction rather than by calculation** — there is no per-section arithmetic to
drift, no percentage whose containing block can be misread, no `vw` unit that includes the
scrollbar.

Measured left-edge spread across nav brand, wordmark, first stat tile, about heading, review
card and footer:

| Viewport    | Left edge | Spread |
| ----------- | --------- | ------ |
| 3825 × 2160 | 1096      | **0**  |
| 2545 × 1440 | 456       | **0**  |
| 1905 × 1080 | 136       | **0**  |
| 1425 × 900  | 50        | **0**  |
| 1009 × 768  | 36        | **0**  |
| 805 × 1180  | 29        | **0**  |
| 375 × 812   | 20        | **0**  |

The gutter scales continuously rather than stepping at breakpoints, so proportions hold across
sizes. Below `110rem` content is genuinely edge-anchored; past it the shell centres, because
review cards three thousand pixels wide are unreadable at any screen size.

**Do not add a competing container.** If a section needs a narrower measure, cap the *content*
(`max-w-[62ch]`), not the shell.

### The stat band

Its tiles carry padding on inner edges only (`pr` always, `pl` only when they have a left
border). Uniform tile padding would inset the first number one tile-width past the shell
gutter and break the left edge against every other band.

## Motion

Full treatment in [motion.md](motion.md). The three things to know before writing any:

**Reduced motion is not automatic for everything.** A global rule in `globals.css` zeroes
`animation-duration` and `transition-duration` with `!important` under
`prefers-reduced-motion: reduce`, and time-based animation inherits it for free. It does
**nothing** to a scroll-driven animation, whose progress comes from scroll position rather than
elapsed time — those rules are wrapped in `@media (prefers-reduced-motion: no-preference)`
explicitly. JavaScript-driven motion checks the media query itself; `GamerScene` and
`AchievementToast` both do.

**Nothing is hidden waiting for JavaScript.** Every animation ends at the state the page would
have had without it, with `both` fill, so a browser that runs none of it shows the finished
page. Scroll reveals are CSS `view()` timelines, not observers adding a class to
`opacity: 0` elements.

**Motion must not move a left edge.** The alignment above is measured, and transforms on cards
and stat tiles are the obvious way to break it. `.ags-reveal` translates on Y only, and the
spread is re-measured as part of the motion checks.
