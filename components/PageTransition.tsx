"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Wraps the page body so a route change fades and lifts the new page in.
 *
 * The `key` is the whole point: without it React reconciles the two pages'
 * markup in place where their shapes happen to match, the DOM nodes survive,
 * and the entrance animation never restarts. Keying on the pathname forces a
 * remount, so `.ags-page` replays on every navigation.
 *
 * `children` stays a server-rendered tree — passing it through a client
 * component does not pull the pages into the client bundle. The pathname is
 * used only as a key and never rendered, so it cannot mismatch on hydration,
 * and the animation is `both`-filled CSS: if this component never hydrates,
 * the server HTML has already finished it.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main key={pathname} className="ags-page flex-1">
      {children}
    </main>
  );
}
