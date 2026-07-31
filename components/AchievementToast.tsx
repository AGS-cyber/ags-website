"use client";

import { useEffect, useRef, useState } from "react";

const ACHIEVEMENTS = [
  { depth: 0.25, name: "SCROLLED PAST THE HERO" },
  { depth: 0.6, name: "STILL HERE, HUH" },
  { depth: 0.95, name: "COMPLETIONIST (100%)" },
];

const VISIBLE_MS = 3500;

/**
 * Fires a bottom-right achievement popup at 25% / 60% / 95% scroll depth.
 * Each one fires at most once. Entirely suppressed under reduced motion.
 */
export default function AchievementToast() {
  const [unlocked, setUnlocked] = useState<string | null>(null);
  const fired = useRef<Set<number>>(new Set());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      return;
    }

    const onScroll = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;

      if (scrollable <= 0) {
        return;
      }

      const depth = window.scrollY / scrollable;

      for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
        if (depth >= ACHIEVEMENTS[i].depth && !fired.current.has(i)) {
          fired.current.add(i);
          setUnlocked(ACHIEVEMENTS[i].name);

          if (hideTimer.current) {
            clearTimeout(hideTimer.current);
          }
          hideTimer.current = setTimeout(() => setUnlocked(null), VISIBLE_MS);
          break;
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  if (!unlocked) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="ags-toast pointer-events-none fixed right-4 bottom-4 z-40 flex items-center gap-3 border border-[var(--border)] bg-[var(--surface)] p-3 sm:right-6 sm:bottom-6 sm:p-4"
    >
      <div
        aria-hidden="true"
        className="mono flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--acid)] text-sm text-[var(--acid)]"
      >
        ★
      </div>
      <div>
        <p className="mono text-[10px] tracking-[0.15em] text-[var(--acid)] uppercase">
          ACHIEVEMENT UNLOCKED
        </p>
        <p className="mono mt-1 text-[11px] tracking-[0.15em] text-[var(--text)] uppercase sm:text-xs">
          {unlocked}
        </p>
      </div>
    </div>
  );
}
