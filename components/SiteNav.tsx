import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "HOME" },
  { href: "/reviews", label: "REVIEWS" },
  { href: "/#about", label: "ABOUT" },
];

/**
 * Top HUD bar. Server component — no pathname sniffing, no client JS.
 */
export default function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur">
      <nav
        aria-label="Main"
        className="shell flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-5"
      >
        <Link
          href="/"
          className="mono text-xs tracking-[0.22em] text-[var(--text)] uppercase transition-colors hover:text-[var(--acid)] sm:text-sm"
        >
          ALLGAMESUCK
        </Link>
        <ul className="flex items-center gap-5 sm:gap-8">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase transition-colors hover:text-[var(--text)] sm:text-[11px]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
