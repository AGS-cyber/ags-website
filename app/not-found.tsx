import Link from "next/link";

export default function NotFound() {
  return (
    <section className="shell py-28 sm:py-40">
      <h1 className="ags-enter mono max-w-[20ch] text-2xl leading-[1.2] tracking-[0.02em] text-[var(--warn)] uppercase sm:text-4xl">
        404 // THIS PAGE SUCKS SO MUCH IT DOESN&apos;T EXIST
      </h1>

      <p className="ags-enter mt-10 max-w-[58ch] text-[17px] leading-[1.75] text-[var(--muted)] [--ags-delay:90ms] sm:text-lg">
        No save file, no checkpoint, no helpful NPC. Whatever you were looking
        for either moved, never shipped, or got cut for time — which, honestly,
        happens to the best of them.
      </p>

      <Link
        href="/"
        className="ags-cta ags-enter mono mt-12 inline-block border border-[var(--acid)] px-6 py-3.5 text-[10px] tracking-[0.18em] text-[var(--acid)] uppercase [--ags-delay:170ms] sm:text-[11px]"
      >
        RETURN TO TITLE SCREEN
      </Link>
    </section>
  );
}
