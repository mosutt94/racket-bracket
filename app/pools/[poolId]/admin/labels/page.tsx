"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PageLoading } from "@/components/PageLoading";
import { PoolNav } from "@/components/PoolNav";
import { getCachedAppState, isPoolCommissioner, loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool, isPickingClosed } from "@/lib/state-helpers";
import type { AppState } from "@/lib/types";

const LABELS = ["Q", "WC", "LL", "PR"];

export default function PlayerLabelsPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(() => getCachedAppState(params.poolId));
  const [query, setQuery] = useState("");
  // Optimistic per-player label overrides on top of the loaded state.
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Tags are a shared-tournament action → site-owner only (once configured).
  const [owner, setOwner] = useState<{ configured: boolean; isOwner: boolean }>({ configured: false, isOwner: false });

  useEffect(() => {
    loadAppState(params.poolId).then(setState);
    fetch("/api/auth/commissioner-status")
      .then((r) => r.json())
      .then((d) => setOwner({ configured: Boolean(d.ownerConfigured), isOwner: Boolean(d.isSiteOwner) }))
      .catch(() => {});
  }, [params.poolId]);

  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;

  const players = useMemo(() => {
    if (!state || !tournament) return [];
    const ids = new Set<string>();
    for (const match of state.matches) {
      if (match.tournamentId !== tournament.id || match.roundNumber !== 1) continue;
      if (match.player1Id) ids.add(match.player1Id);
      if (match.player2Id) ids.add(match.player2Id);
    }
    const byId = new Map(state.players.map((player) => [player.id, player]));
    return Array.from(ids)
      .map((id) => byId.get(id))
      .filter((player): player is NonNullable<typeof player> => Boolean(player))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [state, tournament]);

  if (!state) return <PageLoading />;
  if (!tournament) return null;

  // Once an owner is configured, only they manage shared tags (server enforces it).
  if (owner.configured && !owner.isOwner) {
    return (
      <AppFrame compact slam={tournament.slamType}>
        <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <PoolNav poolId={params.poolId} showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
          <div className="mt-6 rounded-xl border border-court-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black text-ink">Player labels</h1>
            <p className="mt-2 text-sm text-slate-600">Q / WC labels are managed by the site owner. Ask them to add or change a player&apos;s tag.</p>
          </div>
        </main>
      </AppFrame>
    );
  }

  // Labels are shared per-Slam; freeze them once play begins (server enforces it
  // too). They're meant to be set before the tournament starts.
  const tournamentStarted = isPickingClosed(tournament);

  const labelOf = (playerId: string, fallback: string | null | undefined) =>
    Object.prototype.hasOwnProperty.call(overrides, playerId) ? overrides[playerId] : fallback ?? null;

  const filtered = players.filter((player) => player.name.toLowerCase().includes(query.trim().toLowerCase()));
  const labeledCount = players.filter((player) => labelOf(player.id, player.designation)).length;

  async function setLabel(playerId: string, designation: string | null) {
    setBusyId(playerId);
    setError(null);
    try {
      const response = await fetch("/api/admin/player-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: tournament!.id, playerId, designation })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not save label.");
      setOverrides((current) => ({ ...current, [playerId]: designation }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save label.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppFrame compact slam={tournament.slamType}>
      <main className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PoolNav poolId={params.poolId} showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
        <div className="mb-4 mt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-court-700 sm:text-sm">Player labels</p>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">Q / WC labels</h1>
          <p className="mt-1 text-sm text-slate-600">
            ESPN doesn&apos;t provide qualifier (Q) or wild-card (WC) labels, so add them by hand. They show in the bracket
            where the seed number goes. Seeded players already show their seed and don&apos;t need a label.
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{labeledCount} labelled · {players.length} players</p>
          {tournamentStarted ? (
            <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
              🔒 Labels are locked because the tournament has started. They can&apos;t be changed once play is underway.
            </p>
          ) : null}
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search size={18} className="text-slate-400" />
          <input
            className="min-w-0 flex-1 outline-none"
            placeholder="Search a player by name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </label>
        {error ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-court-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No players match &ldquo;{query}&rdquo;.</p>
          ) : (
            filtered.map((player) => {
              const current = labelOf(player.id, player.designation);
              return (
                <div key={player.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{player.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {player.country ?? ""}{player.seed ? `${player.country ? " · " : ""}Seed ${player.seed}` : ""}
                    </span>
                  </span>
                  {player.seed ? (
                    <span className="text-sm font-black text-slate-400">[{player.seed}]</span>
                  ) : (
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {LABELS.map((label) => {
                        const active = current === label;
                        return (
                          <button
                            key={label}
                            onClick={() => setLabel(player.id, active ? null : label)}
                            disabled={busyId === player.id || tournamentStarted}
                            className={
                              active
                                ? "rounded-md border border-court-700 bg-court-700 px-2.5 py-1 text-xs font-black text-white disabled:opacity-50"
                                : "rounded-md border border-court-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:border-court-300 hover:text-court-700 disabled:opacity-50"
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                      {current ? (
                        <button
                          onClick={() => setLabel(player.id, null)}
                          disabled={busyId === player.id || tournamentStarted}
                          className="rounded-md px-2 py-1 text-xs font-bold text-clay-700 hover:bg-clay-100 disabled:opacity-50"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </AppFrame>
  );
}
