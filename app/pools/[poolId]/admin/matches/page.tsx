"use client";

import { RotateCcw, Save, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, Match, Player } from "@/lib/types";

type Drafts = Record<string, { player1Name: string; player1Country: string; player2Name: string; player2Country: string; scoreSummary: string }>;

export default function MatchManagementPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  const [roundFilter, setRoundFilter] = useState(1);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadAppState().then(setState);
  }, []);

  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  const playerById = useMemo(() => new Map((state?.players ?? []).map((player) => [player.id, player])), [state?.players]);
  const matches = useMemo(
    () => (state && tournament ? state.matches.filter((match) => match.tournamentId === tournament.id).sort((a, b) => a.roundNumber - b.roundNumber || a.matchNumber - b.matchNumber) : []),
    [state, tournament]
  );
  const rounds = useMemo(
    () => (state && tournament ? state.rounds.filter((round) => round.tournamentId === tournament.id).sort((a, b) => a.roundNumber - b.roundNumber) : []),
    [state, tournament]
  );

  useEffect(() => {
    if (!state || !tournament) return;
    const nextDrafts: Drafts = {};
    for (const match of matches) {
      const player1 = match.player1Id ? playerById.get(match.player1Id) : null;
      const player2 = match.player2Id ? playerById.get(match.player2Id) : null;
      nextDrafts[match.id] = {
        player1Name: player1?.name ?? "",
        player1Country: player1?.country ?? "",
        player2Name: player2?.name ?? "",
        player2Country: player2?.country ?? "",
        scoreSummary: match.scoreSummary ?? ""
      };
    }
    setDrafts(nextDrafts);
  }, [matches, playerById, state, tournament]);

  if (!state || !tournament) return null;
  const activeTournament = tournament;

  const visibleMatches = matches.filter((match) => match.roundNumber === roundFilter);
  const activeRound = rounds.find((round) => round.roundNumber === roundFilter);

  async function reloadState() {
    setState(await loadAppState());
  }

  async function savePlayer(match: Match, slot: "player1" | "player2") {
    const draft = drafts[match.id];
    if (!draft) return;
    setBusyMatchId(match.id);
    await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        playerSlot: slot,
        name: slot === "player1" ? draft.player1Name : draft.player2Name,
        country: slot === "player1" ? draft.player1Country : draft.player2Country,
        tournamentId: activeTournament.id,
        tournamentInstanceId: activeTournament.tournamentInstanceId,
        createdByUserId: getCurrentUserForState(state!).id
      })
    });
    await reloadState();
    setBusyMatchId(null);
  }

  async function setWinner(match: Match, winner: Player | null) {
    const draft = drafts[match.id];
    setBusyMatchId(match.id);
    await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        winnerPlayerId: winner?.id ?? null,
        scoreSummary: draft?.scoreSummary ?? "",
        tournamentId: activeTournament.id,
        tournamentInstanceId: activeTournament.tournamentInstanceId,
        createdByUserId: getCurrentUserForState(state!).id
      })
    });
    await reloadState();
    setBusyMatchId(null);
  }

  async function clearOverrides(match: Match) {
    setBusyMatchId(match.id);
    await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        tournamentId: activeTournament.id,
        clearOverrides: true
      })
    });
    await reloadState();
    setBusyMatchId(null);
  }

  function setDraft(matchId: string, key: keyof Drafts[string], value: string) {
    setDrafts((current) => ({
      ...current,
      [matchId]: {
        ...current[matchId],
        [key]: value
      }
    }));
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={params.poolId} />
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-court-700">Commissioner bracket editor</p>
            <h1 className="text-3xl font-black text-ink">{activeTournament.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Edit player slots or winners directly. Changes are locked so provider sync will not overwrite them.</p>
          </div>
          <label className="text-sm font-bold text-slate-700">
            Round
            <select
              value={roundFilter}
              onChange={(event) => setRoundFilter(Number(event.target.value))}
              className="ml-2 rounded-lg border border-court-200 bg-white px-3 py-2"
            >
              {rounds.map((round) => (
                <option key={round.id} value={round.roundNumber}>{round.roundName}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-court-200 bg-white p-4 shadow-sm">
          <h2 className="font-black text-ink">{activeRound?.roundName ?? "Round"}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleMatches.map((match) => {
              const player1 = match.player1Id ? playerById.get(match.player1Id) ?? null : null;
              const player2 = match.player2Id ? playerById.get(match.player2Id) ?? null : null;
              const draft = drafts[match.id];
              const overrideCount = state.manualOverrides.filter((override) => override.matchId === match.id && override.locked).length;

              return (
                <article key={match.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black text-ink">Match {match.matchNumber}</h3>
                      <p className="text-xs font-semibold uppercase text-slate-500">{match.status}</p>
                    </div>
                    {overrideCount > 0 ? <span className="rounded-full bg-court-100 px-2 py-1 text-xs font-black text-court-900">Override locked</span> : null}
                  </div>

                  <div className="mt-4 space-y-3">
                    <PlayerEditor
                      label="Player 1"
                      player={player1}
                      name={draft?.player1Name ?? ""}
                      country={draft?.player1Country ?? ""}
                      onName={(value) => setDraft(match.id, "player1Name", value)}
                      onCountry={(value) => setDraft(match.id, "player1Country", value)}
                      onSave={() => savePlayer(match, "player1")}
                      onWinner={() => setWinner(match, player1)}
                      isWinner={match.winnerPlayerId === player1?.id}
                      busy={busyMatchId === match.id}
                    />
                    <PlayerEditor
                      label="Player 2"
                      player={player2}
                      name={draft?.player2Name ?? ""}
                      country={draft?.player2Country ?? ""}
                      onName={(value) => setDraft(match.id, "player2Name", value)}
                      onCountry={(value) => setDraft(match.id, "player2Country", value)}
                      onSave={() => savePlayer(match, "player2")}
                      onWinner={() => setWinner(match, player2)}
                      isWinner={match.winnerPlayerId === player2?.id}
                      busy={busyMatchId === match.id}
                    />
                  </div>

                  <label className="mt-4 block text-xs font-bold uppercase text-slate-500">
                    Score summary
                    <input
                      value={draft?.scoreSummary ?? ""}
                      onChange={(event) => setDraft(match.id, "scoreSummary", event.target.value)}
                      placeholder="6-4, 6-4"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case text-ink"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setWinner(match, null)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                      <RotateCcw size={15} /> Clear winner
                    </button>
                    <button
                      onClick={() => clearOverrides(match)}
                      disabled={busyMatchId === match.id || overrideCount === 0}
                      className="inline-flex items-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-2 text-sm font-bold text-court-800 disabled:border-slate-200 disabled:text-slate-400"
                    >
                      Let feed control this match
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>
    </AppFrame>
  );
}

function PlayerEditor({
  label,
  player,
  name,
  country,
  onName,
  onCountry,
  onSave,
  onWinner,
  isWinner,
  busy
}: {
  label: string;
  player: Player | null;
  name: string;
  country: string;
  onName: (value: string) => void;
  onCountry: (value: string) => void;
  onSave: () => void;
  onWinner: () => void;
  isWinner: boolean;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase text-slate-500">{label}</p>
        {isWinner ? <span className="inline-flex items-center gap-1 text-xs font-black text-court-700"><Trophy size={13} /> Winner</span> : null}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_76px]">
        <input value={name} onChange={(event) => onName(event.target.value)} placeholder="TBD" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" />
        <input value={country} onChange={(event) => onCountry(event.target.value.toUpperCase())} placeholder="USA" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold uppercase" />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={onSave} disabled={!player || busy} className="inline-flex items-center gap-2 rounded-lg bg-court-700 px-3 py-2 text-sm font-bold text-white disabled:bg-slate-300">
          <Save size={15} /> Save player
        </button>
        <button onClick={onWinner} disabled={!player || busy} className="inline-flex items-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-2 text-sm font-bold text-court-800 disabled:text-slate-400">
          <Trophy size={15} /> Mark winner
        </button>
      </div>
    </div>
  );
}
