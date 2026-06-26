"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { loadDashboardState } from "@/lib/app-state-client";
import { clearCurrentUser, getSavedCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";

export function PoolNav({
  poolId,
  compact = false,
  showAccount = false,
  isCommissioner = false
}: {
  poolId: string;
  compact?: boolean;
  showAccount?: boolean;
  isCommissioner?: boolean;
}) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Number of brackets the signed-in user belongs to. The "Brackets" overview
  // link is pointless when you're only in one, so we hide it in that case.
  const [poolCount, setPoolCount] = useState<number | null>(null);

  useEffect(() => {
    const saved = getSavedCurrentUser();
    if (showAccount) setDisplayName(saved?.displayName ?? null);
    if (!saved) return;
    loadDashboardState(saved.id)
      .then((state) => setPoolCount(state.poolMembers.filter((member) => member.userId === saved.id).length))
      .catch(() => {});
  }, [showAccount]);

  async function signOut() {
    clearCurrentUser();
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // Ignore — redirect regardless.
    }
    window.location.href = "/";
  }

  // The home-icon "Brackets" pill returns to the cross-bracket overview
  // (/dashboard). Only show it once we know the user is in more than one
  // bracket — for a single-bracket user the overview is just that one bracket,
  // so the link is clutter. Hidden until the count is known to avoid a flash.
  const showBrackets = poolCount !== null && poolCount > 1;
  const links: Array<{ label: string; href: string; icon?: ReactNode }> = [
    ...(showBrackets ? [{ label: "Brackets", href: "/dashboard", icon: <Home size={14} /> }] : []),
    { label: "Tournament", href: `/pools/${poolId}/bracket` },
    { label: "My Bracket", href: `/pools/${poolId}/my-bracket` },
    { label: "Leaderboard", href: `/pools/${poolId}/leaderboard` },
    ...(isCommissioner ? [{ label: "Admin", href: `/pools/${poolId}/admin` }] : [])
  ];

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
      <nav className={cn("flex flex-wrap items-center gap-2", compact ? "py-1" : "py-3")}>
        {links.map(({ label, href, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              href={href}
              key={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border font-semibold transition",
                isActive
                  ? "border-court-700 bg-court-700 text-white"
                  : "border-court-200 bg-white text-slate-700 hover:border-court-300 hover:text-court-700",
                compact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"
              )}
            >
              {icon}
              {label}
            </Link>
          );
        })}
        {showAccount ? (
          <div className="ml-auto flex items-center gap-2">
            {displayName ? (
              <span className="max-w-[110px] truncate text-xs font-bold text-slate-500">Hi, {displayName}</span>
            ) : null}
            <button
              type="button"
              onClick={signOut}
              className={cn(
                "rounded-full border border-court-200 bg-white font-semibold text-slate-700 transition hover:border-court-300 hover:text-court-700",
                compact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"
              )}
            >
              Sign out
            </button>
          </div>
        ) : null}
      </nav>
    </div>
  );
}
