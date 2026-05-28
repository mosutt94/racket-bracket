"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { BracketBoard } from "@/components/BracketBoard";
import { PoolNav } from "@/components/PoolNav";
import { loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState } from "@/lib/types";

export default function TournamentBracketPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => {
    loadAppState().then(setState);
  }, []);
  if (!state) return null;

  const pool = state.pools.find((item) => item.id === params.poolId);
  const tournament = findTournamentForPool(state, params.poolId);
  if (!pool || !tournament) return <AppFrame><main className="p-8">Tournament not found.</main></AppFrame>;

  const matches = state.matches.filter((match) => match.tournamentId === tournament.id);
  const rounds = state.rounds.filter((round) => round.tournamentId === tournament.id);

  return (
    <AppFrame compact>
      <main className="mx-auto max-w-none px-2 py-1 sm:px-3">
        <PoolNav poolId={pool.id} compact />
        <div className="mb-1">
          <p className="text-xs font-bold uppercase tracking-wide text-court-700">Official draw</p>
          <h1 className="truncate text-lg font-black text-ink sm:text-xl">{tournament.name}</h1>
        </div>
        <BracketBoard mode="real" matches={matches} players={state.players} rounds={rounds} />
      </main>
    </AppFrame>
  );
}
