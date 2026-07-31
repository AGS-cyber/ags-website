import Link from "next/link";
import AchievementToast from "@/components/AchievementToast";
import GamerScene from "@/components/GamerScene";
import ReviewCard from "@/components/ReviewCard";
import { getAllReviews } from "@/lib/reviews";

export default function Home() {
  const reviews = getAllReviews();

  const hoursWasted = reviews.reduce(
    (total, review) => total + review.hoursWasted,
    0,
  );
  const averageScore = reviews.length
    ? Math.round(
        reviews.reduce((total, review) => total + review.score, 0) /
          reviews.length,
      )
    : 0;

  const stats = [
    { label: "GAMES REVIEWED", value: String(reviews.length) },
    {
      label: "HOURS WASTED",
      // Pinned, because summing decimal hour counts leaves float noise.
      value: hoursWasted.toLocaleString("en-US", { maximumFractionDigits: 1 }),
    },
    {
      label: "AVERAGE SCORE",
      // One off-scale score drags the mean into the billions, which does not
      // fit a stat tile. Compact notation keeps the damage visible and legible.
      value:
        Math.abs(averageScore) >= 100_000
          ? averageScore.toLocaleString("en-US", {
              notation: "compact",
              maximumFractionDigits: 1,
            })
          : String(averageScore),
    },
    {
      label: "GAMES THAT DIDN'T SUCK",
      value: String(reviews.filter((review) => review.score === 0).length),
    },
  ];

  return (
    <>
      <AchievementToast />

      {/* ---------------------------------------------------------------- hero */}
      <section className="w-full overflow-hidden border-b border-[var(--border)] py-16 sm:py-20">
        {/*
          No bespoke gutter arithmetic any more. The hero uses the same .shell
          as the nav and every section below, so the wordmark's left edge is
          identical to theirs by construction rather than by calculation — and
          it holds at every width without a percentage, a vw unit, or a
          containing-block subtlety to get wrong.
        */}
        <div className="shell grid items-center gap-12 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <h1
              // Wide tracking flatters small labels and coarsens large type. At
              // this size the letterforms carry themselves and only need room.
              className="mono max-w-full leading-[0.88] tracking-[0.01em] text-[var(--text)] uppercase"
              style={{ fontSize: "clamp(2.25rem, 5vw, 3.25rem)" }}
            >
              ALLGAMESUCK
            </h1>

            <p className="mt-8 max-w-[38ch] text-lg leading-relaxed text-[var(--muted)] sm:text-xl">
              A lifelong opinion, finally with a domain name.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/reviews"
                className="mono border border-[var(--acid)] px-6 py-3.5 text-[10px] tracking-[0.18em] text-[var(--acid)] uppercase transition-colors hover:bg-[var(--acid)] hover:text-[var(--bg)] sm:text-[11px]"
              >
                READ THE REVIEWS
              </Link>
              <a
                href="#about"
                className="mono border border-[var(--border)] px-6 py-3.5 text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase transition-colors hover:border-[var(--border-bright)] hover:text-[var(--text)] sm:text-[11px]"
              >
                WHAT IS THIS
              </a>
            </div>
          </div>

          <GamerScene />
        </div>
      </section>

      {/* ------------------------------------------------------------ stat HUD */}
      <section
        aria-label="Statistics"
        className="border-y border-[var(--border)] bg-[var(--surface)]"
      >
        <div className="shell grid grid-cols-2 sm:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              // Padding sits on the inner edges only, so the first tile's number
              // starts exactly on the shell gutter rather than one tile-padding
              // further in — which is what would break the left edge against
              // every other band on the page.
              className={`border-[var(--border)] py-8 pr-5 sm:py-11 sm:pr-7 ${
                index % 2 === 1 ? "border-l pl-5" : ""
              } ${index > 1 ? "border-t" : ""} sm:border-t-0 ${
                index !== 0 ? "sm:border-l sm:pl-7" : ""
              }`}
            >
              <div className="mono text-3xl tracking-[0.01em] text-[var(--text)] tabular-nums sm:text-4xl">
                {stat.value}
              </div>
              <div className="mono mt-3 text-[9px] leading-relaxed tracking-[0.18em] text-[var(--muted)] uppercase sm:text-[10px]">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------------- about */}
      <section
        id="about"
        className="shell scroll-mt-24 py-24 sm:py-28"
      >
        <h2 className="mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase sm:text-[11px]">
          WHAT IS THIS
        </h2>
        <div className="mt-10 max-w-[62ch] space-y-6 text-[17px] leading-[1.75] text-[var(--text)]/85 sm:text-lg">
          <p>
            I have been allgamesuck online since I was very young. It was a joke
            then, it is a joke now, and a few days ago I found the domain still
            sitting there unclaimed — so it is a joke with a hosting bill now.
          </p>
          <p>
            The scale is simple: zero is the best score a game can get, and
            almost nothing reaches it. A zero does not mean flawless — it means
            I listed everything wrong with it and went back anyway. Everything
            else sits somewhere below, and how far below is the only interesting
            question.
          </p>
          <p>
            The numbers are a bit. The criticism under them is not — a game only
            shows up here if I cared enough to keep playing. Yes, the name is
            now technically a lie. I am as annoyed about that as you are.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------ latest reviews */}
      <section className="shell pb-32">
        <h2 className="mono text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase sm:text-[11px]">
          LATEST REVIEWS
        </h2>

        <ul className="mt-10 space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.slug} review={review} headingLevel="h3" />
          ))}
        </ul>
      </section>
    </>
  );
}
