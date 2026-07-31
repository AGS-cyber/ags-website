# allgamesuck.com — documentation

The reference for this site. The root [`README.md`](../README.md) is the quick start; everything
detailed lives here.

| Document                                 | Covers                                                             |
| ---------------------------------------- | ------------------------------------------------------------------ |
| [architecture.md](architecture.md)       | Stack, rendering model, file map, data layer                       |
| [content.md](content.md)                 | Writing reviews, frontmatter schema, the score scale, editorial voice |
| [design-system.md](design-system.md)     | Tokens, typography, the layout shell, the accent rule              |
| [scene.md](scene.md)                     | The 3D hero scene: geometry, projection, interaction, performance  |
| [conventions.md](conventions.md)         | Error handling, sanctioned `catch` blocks, accessibility, verification |
| [decisions.md](decisions.md)             | Why the site is the way it is, and what was deliberately rejected  |
| [deployment.md](deployment.md)           | Vercel, the domain, DNS                                            |

## What this site is

A personal site for the handle `allgamesuck`, and a review blog attached to it.

The conceit: **every score is negative.** `0` is the best a game can get, `-100` is the worst.
The scale is a joke. The criticism underneath it is not — a game only appears if the author
cared enough to keep playing.

Two games have reached `0`, which makes the domain name technically a lie. The site says so
out loud rather than hiding it.

## The one rule that matters most

**Fail loud, never fake.** A visible failure always beats a
silent fallback. This applies to code *and* to content — inventing a plausible-looking hour
count is the same class of error as swallowing an exception to keep a page rendering.
