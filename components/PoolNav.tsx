"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    if (showAccount) setDisplayName(getSavedCurrentUser()?.displayName ?? null);
  }, [showAccount]);

  function signOut() {
    clearCurrentUser();
    window.location.href = "/";
  }

  // The home-icon "Brackets" pill returns to the cross-bracket overview
  // (/dashboard) — a home icon reads as "go to the overview" instead of a back
  // arrow that implied browser-back. Admin is commissioner-only.
  const links: Array<{ label: string; href: string; icon?: ReactNode }> = [
    { label: "Brackets", href: "/dashboard", icon: <Home size={14} /> },
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
