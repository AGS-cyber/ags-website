# Content

## Adding a review

Drop a `.mdx` file into `content/reviews/`. The filename becomes the URL —
`content/reviews/hollow-knight.mdx` is served at `/reviews/hollow-knight`. Nothing needs
registering; the data layer reads the directory at build time.

Every file needs all of this frontmatter. There are no optional fields:

```yaml
---
title: "Hollow Knight" # game name, used as the page heading
slug: "hollow-knight" # MUST match the filename minus .mdx
score: -19 # 0 is best, -100 nominal worst, below -100 allowed
platform: "PC / Switch / PS4" # free text
year: 2017 # release year
verdict: "One line." # shown on cards, used as the meta description
hoursWasted: 96 # feeds the HOURS WASTED stat; may be fractional
date: "2026-08-04" # ISO
---
```

Then write the body in MDX. `##` headings, paragraphs, lists, blockquotes, links and bold are
all styled for you. The prose measure is capped at `62ch`.

> **`hoursWasted` must be real.** It is a factual claim about the site owner on their own
> site. If you do not know it, ask. Do not estimate a plausible-looking number — see
> [conventions.md](conventions.md).

## The score scale

`ScoreBadge` derives the label from the number, so you only ever set the number.

| Score           | Label               | Treatment                 |
| --------------- | ------------------- | ------------------------- |
| `0` exactly     | `DOESN'T SUCK`      | inverted — acid on `--bg` |
| `-1` to `-20`   | `SUCKS THE LEAST`   | `--acid`                  |
| `-21` to `-50`  | `SUCKS RESPECTABLY` | `--acid`                  |
| `-51` to `-80`  | `SUCKS LOUDLY`      | `--acid`                  |
| `-81` to `-100` | `SUCKS INFINITELY`  | `--warn`                  |
| below `-100`    | `OFF THE SCALE`     | `--warn`                  |

**Zero is rare and load-bearing.** It does not mean flawless — it means the review lists real
problems and concludes they did not matter. Use it sparingly: the negative scores only carry
weight because zero is reachable. The `GAMES THAT DIDN'T SUCK` tile counts zeroes automatically.

**Scores below `-100` are supported and deliberately absurd.** Two things adapt with no
per-review handling: `ScoreBadge` steps its font size down by digit count so a 16-character
score still fits a card at 375px, and the home page switches the average-score tile to compact
notation (`-16.7B`) once an off-scale entry drags the mean into the billions.

## Editorial voice

This is the part a schema cannot enforce, and the part that decides whether the site works.

**The writing must read as someone who loves games and is exasperated by them** — never as
someone who hates games. Affection under the sneer. The premise is only funny if the fondness
is visible; without it the site is just bitter.

Practical rules:

- 300–450 words, two or three `##` subheads, at least one `>` pull-quote.
- Real, specific, defensible criticism of the actual game. Not generic filler.
- Close on a line that lands the affection.
- No profanity beyond a mild "damn" or "hell".
- **Never name or insult individual developers.** Criticise decisions, publishers and
  products — not people.

### The Arknights case

`arknights.mdx` scores `-100000000000` on zero hours played, and its first line says so:
*"I have never played Arknights. Not one stage."*

That disclosure is mandatory, not stylistic. The entry is a **refusal, not a review**, and the
text says which it is and why the number is not a measurement. A joke score attached to a game
the author has not played, presented as though it were a verdict on quality, would be exactly
the kind of fake-but-plausible output the project policy forbids.

If you add another entry like this, disclose it the same way in the body.

## Current lineup

| Game               | Score            | Hours |
| ------------------ | ---------------- | ----- |
| Elden Ring         | `0`              | 217.9 |
| Persona 5          | `-8`             | 117.4 |
| Persona 3 Reload   | `-41`            | 95    |
| Honkai: Star Rail  | `-58`            | 1000  |
| Final Fantasy XVI  | `-62`            | 68    |
| Arknights          | `-100000000000`  | 0     |

Persona 5 is written as the 2017 original (PS4/PS3), not Royal.
