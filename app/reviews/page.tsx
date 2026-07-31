import type { Metadata } from "next";
import ReviewCard from "@/components/ReviewCard";
import { getAllReviews } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Reviews",
  description: "Every game sucks. Some of them suck beautifully.",
};

export default function ReviewsIndex() {
  const reviews = getAllReviews();

  return (
    <section className="shell py-20 sm:py-28">
      <h1 className="mono text-3xl tracking-[0.02em] text-[var(--text)] uppercase sm:text-5xl">
        REVIEWS
      </h1>

      <p className="mt-8 max-w-[60ch] text-[17px] leading-[1.75] text-[var(--muted)] sm:text-lg">
        Scores run from 0 to -100. Zero means it doesn&apos;t suck; -100 means
        it sucks infinitely. A zero is not a perfect game — it is a game whose
        problems I can list in full and do not care about.
      </p>

      <ul className="mt-16 space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.slug} review={review} />
        ))}
      </ul>
    </section>
  );
}
