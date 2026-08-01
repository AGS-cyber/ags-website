import Link from "next/link";
import ScoreBadge from "@/components/ScoreBadge";
import type { Review } from "@/lib/reviews";

type ReviewCardProps = {
  review: Review;
  /**
   * Heading level for the game title. The reviews index puts these directly
   * under its `h1`, the home page nests them under a section `h2`, so the
   * card has to slot into either outline without skipping a level.
   */
  headingLevel?: "h2" | "h3";
};

/** Renders its own `<li>`, so callers map straight into a `<ul>`. */
export default function ReviewCard({
  review,
  headingLevel: Heading = "h2",
}: ReviewCardProps) {
  return (
    // The reveal rides the card's own view() timeline, so a stacked list
    // cascades as you scroll rather than landing all at once.
    <li className="ags-reveal">
      <Link
        href={`/reviews/${review.slug}`}
        className="ags-card flex items-start justify-between gap-5 border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--border-bright)] focus-visible:border-[var(--border-bright)] sm:gap-10 sm:p-8"
      >
        <div className="min-w-0">
          <Heading className="mono text-[15px] tracking-[0.06em] text-[var(--text)] uppercase sm:text-lg">
            {review.title}
          </Heading>
          <p className="mono mt-3 text-[9px] tracking-[0.18em] text-[var(--muted)] uppercase sm:text-[10px]">
            {`${review.year} // ${review.platform}`}
          </p>
          <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.7] text-[var(--muted)] sm:text-base">
            {review.verdict}
          </p>
        </div>
        {/* Wrapper rather than a class on ScoreBadge itself: the badge is also
            used standalone on an article page and should not know about
            cards. */}
        <div className="ags-card-score shrink-0">
          <ScoreBadge score={review.score} />
        </div>
      </Link>
    </li>
  );
}
