# Architecture

## Stack

| Piece      | Version    | Notes                                              |
| ---------- | ---------- | -------------------------------------------------- |
| Next.js    | `16.2.12`  | App Router. Note `params` is a Promise — see below |
| React      | `19.2.4`   |                                                    |
| TypeScript | `^5`       | Strict                                             |
| Tailwind   | `^4`       | CSS-first config, no `tailwind.config.js`          |
| MDX        | `next-mdx-remote@^5` | Rendered server-side via `/rsc`          |
| Frontmatter| `gray-matter@^4` |                                              |

**No database. No authentication. No runtime environment variables.** Content is files on disk,
read at build time. Adding a review means adding a file.

There is no 3D library. The hero scene is hand-rolled — see [scene.md](scene.md).

## Rendering model

Everything is static. `npm run build` prerenders:

- `/` — static
- `/reviews` — static
- `/reviews/[slug]` — SSG, one page per file via `generateStaticParams()`
- `/_not-found` — static

Only three components are client components, and all three are decorative:
`BootSequence`, `AchievementToast`, `GamerScene`. Everything else — including the whole
data layer and all MDX rendering — is server-side.

### Next.js 16 gotcha

`params` is a `Promise` and must be awaited. This applies to both the page and
`generateMetadata`:

```ts
type ReviewPageProps = { params: Promise<{ slug: string }> };

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { slug } = await params;
  // …
}
```

Also: Next 16 removed `next lint`. The `lint` script runs `eslint` directly.

## File map

```
app/
  layout.tsx              root layout — fonts, metadata, chrome, footer
  page.tsx                home — hero, stat band, #about, latest reviews
  not-found.tsx           404, in character
  globals.css             tokens, base styles, .shell, scanlines, motion rules
  reviews/
    page.tsx              review index
    [slug]/page.tsx       single review — generateStaticParams + MDX
components/
  GamerScene.tsx          client — the 3D hero scene (see scene.md)
  BootSequence.tsx        client — fake BIOS overlay, once per session
  AchievementToast.tsx    client — scroll-depth achievement popups
  ReviewCard.tsx          server — shared card for home + index
  ScoreBadge.tsx          server — the score and its band label
  SiteNav.tsx             server — top nav
  Scanlines.tsx           server — fixed CRT overlay
lib/
  reviews.ts              server-only data layer over content/reviews/*.mdx
content/
  reviews/*.mdx           the reviews themselves
docs/                     this folder
```

## Data layer

`lib/reviews.ts` is the only thing that touches the filesystem. It is server-only —
never import it into a client component.

```ts
export type Review = {
  title: string;
  slug: string;        // must match the filename
  score: number;       // 0 is best; below -100 is legal and deliberate
  platform: string;
  year: number;
  verdict: string;
  hoursWasted: number; // may be fractional
  date: string;        // ISO
  content: string;     // MDX body, frontmatter stripped
};

getAllReviews(): Review[]        // sorted by score descending — least bad first
getReview(slug): Review | null
getAllSlugs(): string[]
```

Sorting is score-descending, so `0` sits above `-58`. The home page derives every statistic
from this array — review count, summed hours, mean score, and the count of zeroes. Adding a
review updates the front page with no code change.

### Content failures stop the build

Bad review content is a build error, never a degraded render. `reviewFilenames()` throws when
`content/reviews/` is missing or holds no `.mdx` files, and `parseReviewFile()` throws on absent
frontmatter, a non-numeric `score`/`year`/`hoursWasted`, or a `slug` that disagrees with its
filename.

Without these, a lost directory or a typo'd field would build successfully and render an empty
index, zeroed statistics and a cheerful "0 GAMES REVIEWED" — the silent fallback described in
[conventions.md](conventions.md), and the one outcome we never want.

`getReview()` still returns `null` for an unknown slug. That is a genuine 404, not a
degradation.
