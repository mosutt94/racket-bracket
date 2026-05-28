import Link from "next/link";
import { cn } from "@/lib/utils";

export function PoolNav({ poolId, compact = false }: { poolId: string; compact?: boolean }) {
  const links = [
    ["Home", `/pools/${poolId}`],
    ["Tournament", `/pools/${poolId}/bracket`],
    ["My Bracket", `/pools/${poolId}/my-bracket`],
    ["Leaderboard", `/pools/${poolId}/leaderboard`],
    ["Admin", `/pools/${poolId}/admin`],
    ["Scoring", `/pools/${poolId}/settings`]
  ];

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0">
      <nav className={cn("flex flex-wrap gap-2", compact ? "py-1" : "py-3")}>
        {links.map(([label, href]) => (
          <Link
            href={href}
            key={href}
            className={cn(
              "rounded-full border border-court-100 bg-white font-semibold text-slate-700 hover:border-court-300 hover:text-court-700",
              compact ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
