"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const BOOT_LINES = [
  "> POWERING ON ANYWAY...",
  "> MOUNTING GRIEVANCES...",
  "> CALIBRATING DISAPPOINTMENT...",
  "> LOADING 4,000 HOURS OF REGRET...",
  "> CHECKING FOR DAY-ONE PATCH...",
  "> READY. STILL PLAYING ANYWAY.",
];

const SESSION_KEY = "ags_booted";
const LINE_DELAY = 250;
const HOLD = 250;
const FADE = 300;

/** 6 lines * 250ms + 250ms hold + 300ms fade = 2050ms, comfortably under 2.2s. */
const RUN_MS = BOOT_LINES.length * LINE_DELAY + HOLD;

/**
 * Whether the boot sequence should play, read as an external store so that the
 * server render and the hydrating render both see `false` and React swaps in
 * the real answer straight after hydration — no state-syncing effect needed.
 *
 * Decided once per page load and cached, because `useSyncExternalStore`
 * requires a stable snapshot.
 */
let cachedShouldBoot: boolean | null = null;

function computeShouldBoot(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Reduced motion: never render the overlay at all.
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }

  try {
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") {
      return false;
    }
  } catch {
    // Storage blocked (private mode): fall through and just play it.
  }

  return true;
}

function getSnapshot(): boolean {
  if (cachedShouldBoot === null) {
    cachedShouldBoot = computeShouldBoot();
  }
  return cachedShouldBoot;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(): () => void {
  // The decision never changes within a page load.
  return () => {};
}

export default function BootSequence() {
  const shouldBoot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const [visibleLines, setVisibleLines] = useState(0);
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const skip = useCallback(() => setDismissed(true), []);

  useEffect(() => {
    if (!shouldBoot || dismissed) {
      return;
    }

    // Mark the session as booted so this plays at most once per browser session.
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Non-fatal.
    }

    // Holds the page's own entrance animations at their first frame while the
    // overlay covers the screen, so the site arrives after the boot rather
    // than behind it. Set only while the overlay is actually mounted, and
    // removed by this effect's cleanup — which React runs when `dismissed`
    // flips as well as on unmount, so it cannot outlive the overlay.
    const root = document.documentElement;
    root.dataset.agsBooting = "";

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i <= BOOT_LINES.length; i += 1) {
      timers.push(setTimeout(() => setVisibleLines(i), i * LINE_DELAY));
    }
    timers.push(setTimeout(() => setFading(true), RUN_MS));
    timers.push(setTimeout(() => setDismissed(true), RUN_MS + FADE));

    return () => {
      delete root.dataset.agsBooting;
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [shouldBoot, dismissed]);

  // Unmounted once finished, so nothing can sit on top of the page.
  if (!shouldBoot || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Boot sequence"
      className={`fixed inset-0 z-[60] flex flex-col justify-center bg-[var(--bg)] px-6 transition-opacity duration-300 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={skip}
        className="mono absolute top-4 right-4 border border-[var(--border)] px-3 py-2 text-[10px] tracking-[0.15em] text-[var(--muted)] uppercase transition-colors hover:border-[var(--acid)] hover:text-[var(--acid)] sm:text-xs"
      >
        [SKIP]
      </button>

      <div className="mx-auto w-full max-w-xl">
        {BOOT_LINES.slice(0, visibleLines).map((line, index) => (
          <p
            key={line}
            // Each line mounts on its own timer, so ags-boot-line runs once as
            // it appears — the lines type themselves in rather than blinking on.
            className={`ags-boot-line mono text-xs tracking-[0.15em] text-[var(--acid)] uppercase sm:text-sm ${
              index === visibleLines - 1 ? "ags-caret" : ""
            }`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
