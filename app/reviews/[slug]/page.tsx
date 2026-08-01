import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import ScoreBadge from "@/components/ScoreBadge";
import { getAllSlugs, getReview } from "@/lib/reviews";

type ReviewPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ReviewPageProps): Promise<Metadata> {
  const { slug } = await params;
  const review = getReview(slug);

  if (!review) {
    return { title: "Not Found" };
  }

  return {
    title: review.title,
    description: review.verdict,
    openGraph: {
      title: review.title,
      description: review.verdict,
    },
    twitter: {
      card: "summary_large_image",
      title: review.title,
      description: review.verdict,
    },
  };
}

// Only the section headings and the pull-quote get a scroll reveal. Animating
// every paragraph would put motion under the reader for the whole article; the
// headings alone give the scroll a rhythm and leave the prose still.
const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2
      className="ags-reveal mono mt-16 mb-6 text-[10px] tracking-[0.22em] text-[var(--muted)] uppercase sm:text-[11px]"
      {...props}
    />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p
      className="mb-6 text-[17px] leading-[1.8] text-[var(--text)]/85 sm:text-lg"
      {...props}
    />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-6 space-y-3 pl-5" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li
      className="list-outside list-disc text-[17px] leading-[1.8] text-[var(--text)]/85 marker:text-[var(--muted)] sm:text-lg"
      {...props}
    />
  ),
  // The pull-quote earns the one piece of acid on the page: a hairline, not a
  // filled panel. The type does the work; the rule just marks where to look.
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="ags-reveal my-12 border-l border-[var(--acid)] py-1 pl-7 text-xl leading-[1.6] text-[var(--text)] italic sm:text-2xl"
      {...props}
    />
  ),
  a: (props: ComponentPropsWithoutRef<"a">) => (
    <a
      className="text-[var(--acid)] underline underline-offset-4 transition-opacity hover:opacity-70"
      {...props}
    />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-[var(--text)]" {...props} />
  ),
};

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { slug } = await params;
  const review = getReview(slug);

  if (!review) {
    notFound();
  }

  const meta = [
    { label: "YEAR", value: String(review.year) },
    { label: "PLATFORM", value: review.platform },
    { label: "HOURS WASTED", value: String(review.hoursWasted) },
  ];

  return (
    <article className="shell py-20 sm:py-28">
      <Link
        href="/reviews"
        // ags-shift nudges it left on hover — the direction it takes you.
        className="ags-enter ags-shift mono inline-block text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase hover:text-[var(--text)] sm:text-[11px]"
      >
        [ BACK TO REVIEWS ]
      </Link>

      <header className="mt-14 flex flex-col gap-10 border-b border-[var(--border)] pb-14 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="ags-enter mono text-3xl leading-[1.1] tracking-[0.02em] text-[var(--text)] uppercase [--ags-delay:70ms] sm:text-5xl">
            {review.title}
          </h1>

          <dl className="ags-enter mt-8 flex flex-wrap gap-x-10 gap-y-4 [--ags-delay:140ms]">
            {meta.map((item) => (
              <div key={item.label}>
                <dt className="mono text-[9px] tracking-[0.2em] text-[var(--muted)] uppercase">
                  {item.label}
                </dt>
                <dd className="mono mt-2 text-xs tracking-[0.08em] text-[var(--text)] tabular-nums uppercase">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="ags-enter mt-10 max-w-[58ch] text-[17px] leading-[1.75] text-[var(--muted)] [--ags-delay:210ms] sm:text-lg">
            {review.verdict}
          </p>
        </div>

        <div className="ags-enter shrink-0 [--ags-delay:280ms]">
          <ScoreBadge score={review.score} size="lg" />
        </div>
      </header>

      <div className="mt-16 max-w-[62ch]">
        <MDXRemote source={review.content} components={mdxComponents} />
      </div>
    </article>
  );
}
