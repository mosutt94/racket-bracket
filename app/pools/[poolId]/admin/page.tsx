"use client";

import Link from "next/link";
import { CalendarClock, Lock, Settings, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { getLeaderboard } from "@/lib/services/scoring-service";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, TournamentStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

interface SyncStatus {
  ok?: boolean;
  error?: string;
  providerName?: string;
  matchesUpdated?: number;
  winnersApplied?: number;
  matchesAdvanced?: number;
  matchLinksUpdated?: number;
  skippedManualOverrides?: number;
  needsReview?: number;
  scoring?: {
    bracketsScored: number;
    picksScored: number;
  };
}

export default function AdminPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    loadAppState().then(setState);
  }, []);
  if (!state) return null;

  const pool = state.pools.find((item) => item.id === params.poolId);
  const tournament = findTournamentForPool(state, params.poolId);
  if (!pool || !tournament) return null;
  const activePool = pool;
  const activeTournament = tournament;
  const isCommissioner = activePool.commissionerUserId === getCurrentUserForState(state).id;
  const members = state.poolMembers.filter((member) => member.poolId === activePool.id);
  const leaderboard = getLeaderboard(state, activePool.id, activeTournament.id);
  const submitted = state.brackets.filter((bracket) => bracket.poolId === activePool.id && bracket.tournamentId === activeTournament.id && bracket.status !== "draft");
  const activeInstance = state.tournamentInstances.find((instance) => instance.id === activeTournament.tournamentInstanceId);
  const syncRuns = state.providerSyncRuns
    .filter((run) => run.tournamentId === activeTournament.id || run.tournamentInstanceId === activeTournament.tournamentInstanceId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const lastSync = syncRuns[0];

  async function setTournamentStatus(status: TournamentStatus) {
    try {
      const response = await fetch("/api/admin/tournament-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: activeTournament.id, status })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not update status.");
      setState(await loadAppState());
    } catch (error) {
      setSyncStatus({ ok: false, error: error instanceof Error ? error.message : "Could not update status." });
    }
  }

  async function sync() {
    setBusy(true);
    setSyncStatus(null);
    const response = await fetch("/api/admin/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: activeTournament.id,
        tournamentInstanceId: activeTournament.tournamentInstanceId,
        providerName: "espn",
        syncType: "match_updates"
      })
    });
    setSyncStatus(await response.json());
    setState(await loadAppState());
    setBusy(false);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={activePool.id} />
        <div className="mb-5">
          <p className="text-sm font-bold uppercase tracking-wide text-court-700">Commissioner dashboard</p>
          <h1 className="text-3xl font-black text-ink">{activePool.name}</h1>
          {!isCommissioner ? <p className="mt-2 text-sm font-semibold text-clay-700">Only the commissioner can use these tools.</p> : null}
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric icon={<Users />} label="Members" value={members.length} />
          <Metric icon={<Lock />} label="Submitted" value={`${submitted.length}/${members.length}`} />
          <Metric icon={<CalendarClock />} label="Draw status" value={activeInstance?.status.replace("_", " ") ?? activeTournament.status} small />
          <Metric icon={<Settings />} label="Last sync" value={formatDateTime(activeTournament.lastSyncedAt ?? activeInstance?.lastSyncedAt)} small />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-xl border border-court-100 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2 text-court-700">
                  <CalendarClock size={18} />
                  <p className="text-xs font-black uppercase tracking-wide">ESPN result sync</p>
                </div>
                <h2 className="mt-2 text-xl font-black text-ink">{activeTournament.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pull final results from ESPN, advance winners, and update the leaderboard.
                </p>
                {lastSync ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Last sync: {lastSync.syncType} · {lastSync.status} · {formatDateTime(lastSync.finishedAt)}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2 md:min-w-[220px]">
                <button onClick={sync} disabled={busy} className="rounded-lg bg-court-700 px-4 py-3 font-bold text-white disabled:bg-slate-300">
                  {busy ? "Updating..." : "Apply ESPN results"}
                </button>
              </div>
              {syncStatus ? (
                <p className={syncStatus.ok ? "mt-3 text-sm font-bold text-court-700" : "mt-3 text-sm font-bold text-clay-700"}>
                  {syncStatus.ok
                    ? `Updated ${syncStatus.matchesUpdated ?? 0} matches, applied ${syncStatus.winnersApplied ?? 0} winners, advanced ${syncStatus.matchesAdvanced ?? 0} slots, rescored ${syncStatus.scoring?.bracketsScored ?? 0} brackets.`
                    : syncStatus.error ?? "Could not apply ESPN results."}
                </p>
              ) : null}
            </div>
          </section>
          <section className="rounded-xl border border-court-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Bracket tools</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button onClick={() => setTournamentStatus("locked")} className="rounded-lg bg-ink px-4 py-3 font-bold text-white">Lock picking</button>
              <button onClick={() => setTournamentStatus("picking_open")} className="rounded-lg border border-court-200 px-4 py-3 font-bold text-court-800">Unlock picking</button>
            </div>
          </section>
          <section className="rounded-xl border border-court-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Bracket corrections</h2>
            <p className="mt-1 text-sm text-slate-600">
              Open the bracket editor, find the match, edit the player names or mark the winner, and corrections are locked against future sync overwrites.
            </p>
            <Link href={`/pools/${activePool.id}/admin/matches`} className="mt-4 inline-flex rounded-lg bg-ink px-4 py-2 font-bold text-white">
              Open bracket editor
            </Link>
          </section>
          <section className="rounded-xl border border-court-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Submission tracker</h2>
            <div className="mt-4 space-y-2">
              {leaderboard.map((row) => (
                <div key={row.userId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-semibold">{row.displayName}</span>
                  <span className="text-sm font-bold text-slate-600">{row.bracketStatus}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </AppFrame>
  );
}

function Metric({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-court-100 bg-white p-4 shadow-sm">
      <div className="text-court-700">{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={small ? "mt-1 text-sm font-black" : "mt-1 text-2xl font-black"}>{value}</p>
    </div>
  );
}
