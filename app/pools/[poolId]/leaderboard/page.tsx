"use client";

import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PageLoading } from "@/components/PageLoading";
import { PoolNav } from "@/components/PoolNav";
import { getLeaderboard } from "@/lib/services/scoring-service";
import { getCachedAppState, isPoolCommissioner, loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool, isPickingClosed } from "@/lib/state-helpers";
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
  // The Slam has concluded once every match in the draw is decided. This is the
  // reliable signal — the commissioner-controlled status flag is never auto-set
  // to "completed", so we read the bracket itself rather than trust the flag.
  const tournamentMatches = state.matches.filter((match) => match.tournamentId === tournament.id);
  const concluded =
    tournament.status === "completed" ||
    (tournamentMatches.length > 0 && tournamentMatches.every((match) => match.status === "completed"));
  // Crown the top scorer(s). Ties share the crown as co-champions. A 0-point
  // "winner" isn't a winner, so only crown once someone has actually scored.
  const topScore = leaderboard.length ? leaderboard[0].score : 0;
  const champions = concluded && topScore > 0 ? leaderboard.filter((row) => row.score === topScore) : [];
  const championIds = new Set(champions.map((champion) => champion.userId));
  // Other members' brackets open up once picking closes (anti-copy) — and a
  // concluded tournament is closed by definition, regardless of the flag.
  const pickingClosed = concluded || isPickingClosed(tournament);
  const hasBracket = (userId: string) =>
    state.brackets.some((item) => item.poolId === params.poolId && item.tournamentId === tournament.id && item.userId === userId);
  const rowBase = "grid items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0";
  // Reserve a trailing column for the disclosure chevron once picking is closed,
  // so viewable and non-viewable rows stay aligned.
  const gridCols = pickingClosed ? "grid-cols-[32px_minmax(0,1fr)_auto_16px]" : "grid-cols-[32px_minmax(0,1fr)_auto]";

  return (
    <AppFrame compact slam={tournament.slamType}>
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PoolNav poolId={params.poolId} showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
        <div className="mb-4 mt-1">
          <h1 className="text-2xl font-black text-ink sm:text-3xl">Leaderboard</h1>
          {pickingClosed ? (
            <p className="mt-1 text-sm font-semibold text-slate-500">Tap a player to view their bracket.</p>
          ) : null}
        </div>
        {champions.length > 0 ? (
          <div className="mb-5 max-w-3xl overflow-hidden rounded-xl bg-court-900 shadow-soft">
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ball text-court-900">
                <Crown size={24} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-ball">
                  {champions.length > 1 ? "Co-champions" : "Champion"}
                </p>
                <p className="truncate text-xl font-black text-white sm:text-2xl">
                  {joinNames(champions.map((champion) => champion.displayName))}
                </p>
                <p className="text-sm font-semibold text-court-50">
                  {tournament.name} · {topScore} {topScore === 1 ? "pt" : "pts"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="max-w-3xl overflow-hidden rounded-xl border border-court-200 bg-white shadow-sm">
          {leaderboard.map((row, index) => {
            const viewable = pickingClosed && hasBracket(row.userId);
            const isChampion = championIds.has(row.userId);
            const cells = (
              <>
                <span className="flex items-center text-sm font-black text-slate-500">
                  {isChampion ? <Crown size={16} className="text-amber-500" aria-label="Champion" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{row.displayName}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {!row.started ? "Not started" : row.complete ? "Complete" : "Incomplete"}{row.locked ? " · Locked" : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-black" title="Current score / potential if all remaining picks hit">
                    <span className="text-court-700">{row.score}</span>
                    <span className="text-slate-400">/{row.potentialScore}</span>
                  </span>
                  <span className="block text-xs font-semibold text-slate-500" title="Picks that have come true so far, regardless of point value">
                    {row.correctPicks} correct
                  </span>
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

// "Ana" · "Ana & Beto" · "Ana, Beto & Cy"
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}
