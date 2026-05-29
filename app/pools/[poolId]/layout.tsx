import type { Viewport } from "next";

// In-pool pages are an app-like, single-surface experience — the bracket scrolls
// inside its own container while the page itself stays fixed. Lock the viewport
// scale so these pages always load at 1:1 and pinch-zoom can't leave the fixed
// layout misaligned (there's no page scroll to recenter it). Public/onboarding
// pages (landing, auth, join) keep normal zoom for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false
};

export default function PoolLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
