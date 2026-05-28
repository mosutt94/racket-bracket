"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { getLeaderboard } from "@/lib/services/scoring-service";
import { loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";
import { useAutoSync } from "@/lib/use-auto-sync";
import type { AppState } from "@/lib/types";

export default function LeaderboardPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => {
    loadAppState().then(setState);
  }, []);
  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  useAutoSync(tournament, {
    onSynced: async () => setState(await loadAppState())
  });

  if (!state) return null;
  if (!tournament) return null;
  const leaderboard = getLeaderboard(state, params.poolId, tournament.id);

  return (
    <AppFrame>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={params.poolId} />
        <h1 className="text-3xl font-black text-ink">Leaderboard</h1>
        <div className="mt-5 overflow-hidden rounded-xl border border-court-100 bg-white shadow-sm">
          {leaderboard.map((row, index) => (
            <div key={row.userId} className="grid grid-cols-[52px_1fr_90px] items-center border-b border-slate-100 px-4 py-4 last:border-b-0">
              <span className="text-sm font-black text-slate-500">{index + 1}</span>
              <span>
                <span className="block font-bold">{row.displayName}</span>
                <span className="text-xs text-slate-500">{row.role} · {row.bracketStatus}</span>
              </span>
              <span className="text-right text-xl font-black text-court-700">{row.score}</span>
            </div>
          ))}
        </div>
      </main>
    </AppFrame>
  );
}
