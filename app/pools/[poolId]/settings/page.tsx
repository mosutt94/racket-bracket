"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, TournamentRound } from "@/lib/types";

export default function ScoringSettingsPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAppState().then((loaded) => {
      const tournament = findTournamentForPool(loaded, params.poolId);
      setState(loaded);
      setRounds(tournament ? loaded.rounds.filter((round) => round.tournamentId === tournament.id) : []);
    });
  }, [params.poolId]);

  if (!state) return null;
  const tournament = findTournamentForPool(state, params.poolId);

  async function save() {
    if (!tournament) return;
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/admin/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          rounds: rounds.map((round) => ({ roundNumber: round.roundNumber, pointsPerCorrectPick: round.pointsPerCorrectPick }))
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not save scoring.");
      setSaveStatus("saved");
      // Refresh local state so the form reflects what's in the DB.
      const refreshed = await loadAppState();
      setState(refreshed);
      setRounds(refreshed.rounds.filter((round) => round.tournamentId === tournament.id));
    } catch (error) {
      setSaveStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Could not save scoring.");
    }
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={params.poolId} />
        <div className="rounded-xl border border-court-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-black text-ink">Scoring configuration</h1>
          <p className="mt-2 text-sm text-slate-600">Commissioners can change these values before the tournament starts.</p>
          <div className="mt-6 space-y-4">
            {rounds.map((round) => (
              <label key={round.id} className="grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-[1fr_140px] sm:items-center">
                {round.roundName}
                <input
                  type="number"
                  min={0}
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  value={round.pointsPerCorrectPick}
                  onChange={(event) =>
                    setRounds((items) => items.map((item) => item.id === round.id ? { ...item, pointsPerCorrectPick: Number(event.target.value) } : item))
                  }
                />
              </label>
            ))}
          </div>
          {errorMessage ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{errorMessage}</p> : null}
          <button
            onClick={save}
            disabled={saveStatus === "saving" || !tournament}
            className="mt-6 rounded-lg bg-court-700 px-4 py-3 font-bold text-white disabled:bg-slate-300"
          >
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save scoring"}
          </button>
        </div>
      </main>
    </AppFrame>
  );
}
