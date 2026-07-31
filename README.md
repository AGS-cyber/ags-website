# allgamesuck.com

A personal site for the handle I have had since I was very young, and the review blog attached
to it.

Two things live here:

1. **A landing page** with a deliberately hostile game-UI aesthetic — fake boot sequence,
   achievement toasts, HUD chrome, and a draggable 3D wireframe of someone at a desk. Serious
   content, comedic packaging.
2. **`/reviews`** — a game review blog where `0` is the best score a game can get and `-100` is
   the worst. The scale is the joke. The criticism underneath it is not.

Next.js 16 (App Router), TypeScript, Tailwind v4, MDX. No database, no auth, no environment
variables.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # production build — must exit 0
npm start        # serve the production build
npm run lint     # eslint — must exit 0
```

## Adding a review

Drop a `.mdx` file into `content/reviews/`. The filename becomes the URL. Nothing needs
registering.

Full frontmatter schema, the score bands and the editorial rules are in
**[docs/content.md](docs/content.md)**.

## Documentation

Everything detailed lives in **[docs/](docs/README.md)**:

| Document                                       | Covers                                                    |
| ---------------------------------------------- | --------------------------------------------------------- |
| [architecture.md](docs/architecture.md)        | Stack, rendering model, file map, data layer               |
| [content.md](docs/content.md)                  | Reviews, frontmatter, the score scale, editorial voice     |
| [design-system.md](docs/design-system.md)      | Tokens, typography, the layout shell, the accent rule      |
| [scene.md](docs/scene.md)                      | The 3D hero scene                                          |
| [conventions.md](docs/conventions.md)          | Error handling, sanctioned `catch` blocks, verification    |
| [decisions.md](docs/decisions.md)              | Why things are the way they are, and what was rejected     |
| [deployment.md](docs/deployment.md)            | Vercel, the domain, DNS                                    |


## The one rule

**Fail loud, never fake.** A visible failure always beats a silent fallback — in code and in
content. See [conventions.md](docs/conventions.md).
