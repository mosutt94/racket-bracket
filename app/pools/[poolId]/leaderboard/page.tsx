"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PageLoading } from "@/components/PageLoading";
import { PoolNav } from "@/components/PoolNav";
import { getLeaderboard } from "@/lib/services/scoring-service";
import { getCachedAppState, isPoolCommissioner, loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";
import { useAutoSync } from "@/lib/use-auto-sync";
import type { AppState } from "@/lib/types";

export default function LeaderboardPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(() => getCachedAppState(params.poolId));
  useEffect(() => {
    loadAppState(params.poolId).then(setState);
  }, [params.poolId]);
  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  useAutoSync(tournament, {
    onSynced: async () => setState(await loadAppState(params.poolId))
  });

  if (!state) return <PageLoading />;
  if (!tournament) return null;
  const leaderboard = getLeaderboard(state, params.poolId, tournament.id);
  // Other members' brackets only open up once picking closes (anti-copy).
  const pickingClosed = tournament.status !== "picking_open";
  const hasBracket = (userId: string) =>
    state.brackets.some((item) => item.poolId === params.poolId && item.tournamentId === tournament.id && item.userId === userId);
  const rowBase = "grid items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0";
  // Reserve a trailing column for the disclosure chevron once picking is closed,
  // so viewable and non-viewable rows stay aligned.
  const gridCols = pickingClosed ? "grid-cols-[32px_minmax(0,1fr)_auto_16px]" : "grid-cols-[32px_minmax(0,1fr)_auto]";

  return (
    <AppFrame compact>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={params.poolId} showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
        <h1 className="text-2xl font-black text-ink sm:text-3xl">Leaderboard</h1>
        {pickingClosed ? (
          <p className="mt-1 text-sm font-semibold text-slate-500">Tap a player to view their bracket.</p>
        ) : null}
        <div className="mt-5 overflow-hidden rounded-xl border border-court-200 bg-white shadow-sm">
          {leaderboard.map((row, index) => {
            const viewable = pickingClosed && hasBracket(row.userId);
            const cells = (
              <>
                <span className="text-sm font-black text-slate-500">{index + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{row.displayName}</span>
                  <span className="block truncate text-xs text-slate-500">{row.role} · {row.bracketStatus}</span>
                </span>
                <span className="text-right text-lg font-black" title="Current score / potential if all remaining picks hit">
                  <span className="text-court-700">{row.score}</span>
                  <span className="text-slate-400">/{row.potentialScore}</span>
                </span>
                {viewable ? <ChevronRight size={16} className="shrink-0 text-slate-300" /> : null}
              </>
            );
            return viewable ? (
              <Link key={row.userId} href={`/pools/${params.poolId}/member/${row.userId}`} className={`${rowBase} ${gridCols} transition hover:bg-court-50`}>
                {cells}
              </Link>
            ) : (
              <div key={row.userId} className={`${rowBase} ${gridCols}`}>
                {cells}
              </div>
            );
          })}
        </div>
      </main>
    </AppFrame>
  );
}
