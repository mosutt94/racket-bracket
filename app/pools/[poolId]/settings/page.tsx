"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { loadAppState } from "@/lib/app-state-client";
import { saveState, updateRoundPoints } from "@/lib/demo-store";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, TournamentRound } from "@/lib/types";

export default function ScoringSettingsPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);

  useEffect(() => {
    loadAppState().then((loaded) => {
    const tournament = findTournamentForPool(loaded, params.poolId);
    setState(loaded);
    setRounds(tournament ? loaded.rounds.filter((round) => round.tournamentId === tournament.id) : []);
    });
  }, [params.poolId]);

  if (!state) return null;

  function save() {
    const nextState = updateRoundPoints(state!, rounds);
    saveState(nextState);
    setState(nextState);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={params.poolId} />
        <div className="rounded-xl border border-court-100 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-ink">Scoring configuration</h1>
          <p className="mt-2 text-sm text-slate-600">Commissioners can change these values before the tournament starts.</p>
          <div className="mt-6 space-y-4">
            {rounds.map((round) => (
              <label key={round.id} className="grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-[1fr_140px] sm:items-center">
                {round.roundName}
                <input
                  type="number"
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  value={round.pointsPerCorrectPick}
                  onChange={(event) =>
                    setRounds((items) => items.map((item) => item.id === round.id ? { ...item, pointsPerCorrectPick: Number(event.target.value) } : item))
                  }
                />
              </label>
            ))}
          </div>
          <button onClick={save} className="mt-6 rounded-lg bg-court-700 px-4 py-3 font-bold text-white">
            Save scoring
          </button>
        </div>
      </main>
    </AppFrame>
  );
}
