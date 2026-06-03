"use client";

import { useEffect } from "react";

/**
 * Mobile browsers (iOS Safari/Chrome especially) restore a backgrounded tab
 * from the back/forward cache and paint a frozen snapshot without re-running
 * the page's JavaScript. Our client pages render nothing until their data
 * loads, so a restore can leave a blank screen that only a manual refresh
 * fixes. When the browser signals a bfcache restore (pageshow with persisted),
 * reload so the app re-initializes cleanly. A fresh load reports persisted=false,
 * so this never loops.
 */
export function BfcacheRecovery() {
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
