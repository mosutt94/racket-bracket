"use client";

import Link from "next/link";
import { CalendarClock, Lock, Settings, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { StatusBadge } from "@/components/StatusBadge";
import { getCachedAppState, getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, TournamentRound, TournamentStatus } from "@/lib/types";
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
  const [state, setState] = useState<AppState | null>(getCachedAppState);
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [statusBusy, setStatusBusy] = useState<TournamentStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [scoringRounds, setScoringRounds] = useState<TournamentRound[]>([]);
  const [scoringSave, setScoringSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadAppState().then(setState);
  }, []);

  // Keep the editable scoring rows in sync with loaded state.
  useEffect(() => {
    if (!state) return;
    const t = findTournamentForPool(state, params.poolId);
    if (!t) return;
    setScoringRounds(
      state.rounds.filter((round) => round.tournamentId === t.id).sort((a, b) => a.roundNumber - b.roundNumber)
    );
  }, [state, params.poolId]);

  if (!state) return null;

  const pool = state.pools.find((item) => item.id === params.poolId);
  const tournament = findTournamentForPool(state, params.poolId);
  if (!pool || !tournament) return null;
  const activePool = pool;
  const activeTournament = tournament;
  const isCommissioner = activePool.commissionerUserId === getCurrentUserForState(state).id;
  const isPickingOpen = activeTournament.status === "picking_open";
  const isLocked = activeTournament.status === "locked";
  const members = state.poolMembers.filter((member) => member.poolId === activePool.id);
  // Drive the submission tracker off the brackets that actually exist for this
  // pool, not the member list. The two can drift apart (email-based identity can
  // split a person across profile ids), and we must be able to delete every real
  // bracket regardless of whether it maps cleanly to a member row.
  const poolBrackets = state.brackets.filter((item) => item.poolId === activePool.id && item.tournamentId === activeTournament.id);
  const submittedUserIds = new Set(poolBrackets.map((item) => item.userId));
  const membersWithoutBracket = members.filter((member) => !submittedUserIds.has(member.userId));
  const profileName = (userId: string) => state.profiles.find((profile) => profile.id === userId)?.displayName ?? "Unknown player";
  const submitted = poolBrackets.filter((bracket) => bracket.status !== "draft");
  const activeInstance = state.tournamentInstances.find((instance) => instance.id === activeTournament.tournamentInstanceId);
  const syncRuns = state.providerSyncRuns
    .filter((run) => run.tournamentId === activeTournament.id || run.tournamentInstanceId === activeTournament.tournamentInstanceId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const lastSync = syncRuns[0];

  async function setTournamentStatus(status: TournamentStatus) {
    setStatusBusy(status);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/tournament-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: activeTournament.id, status })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not update status.");
      setState(await loadAppState());
      setStatusMessage({ ok: true, text: status === "picking_open" ? "Picking is now open." : "Picking is now locked." });
    } catch (error) {
      setStatusMessage({ ok: false, text: error instanceof Error ? error.message : "Could not update status." });
    } finally {
      setStatusBusy(null);
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

  async function saveScoring() {
    setScoringSave("saving");
    setScoringError(null);
    try {
      const response = await fetch("/api/admin/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          rounds: scoringRounds.map((round) => ({ roundNumber: round.roundNumber, pointsPerCorrectPick: round.pointsPerCorrectPick }))
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not save scoring.");
      setScoringSave("saved");
      setState(await loadAppState());
    } catch (error) {
      setScoringSave("error");
      setScoringError(error instanceof Error ? error.message : "Could not save scoring.");
    }
  }

  async function removeMember(userId: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName} from this bracket? This deletes their picks and they'll need a new invite to rejoin.`)) return;
    setDeletingUserId(userId);
    setDeleteMessage(null);
    try {
      const response = await fetch("/api/admin/remove-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: activePool.id, userId })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not remove member.");
      setState(await loadAppState());
      setDeleteMessage({ ok: true, text: `Removed ${displayName}.` });
    } catch (error) {
      setDeleteMessage({ ok: false, text: error instanceof Error ? error.message : "Could not remove member." });
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <AppFrame compact>
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PoolNav poolId={activePool.id} showAccount isCommissioner={isCommissioner} />
        <div className="mb-4 mt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-court-700 sm:text-sm">Commissioner dashboard</p>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{activePool.name}</h1>
          {!isCommissioner ? <p className="mt-2 text-sm font-semibold text-clay-700">Only the commissioner can use these tools.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric icon={<Users />} label="Members" value={members.length} />
          <Metric icon={<Lock />} label="Submitted" value={`${submitted.length}/${members.length}`} />
          <Metric icon={<CalendarClock />} label="Draw status" value={activeInstance?.status.replace("_", " ") ?? activeTournament.status} small />
          <Metric icon={<Settings />} label="Last sync" value={formatDateTime(activeTournament.lastSyncedAt ?? activeInstance?.lastSyncedAt)} small />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm lg:col-span-2">
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
                  {busy ? "Syncing..." : "Sync scores from ESPN"}
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
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Bracket tools</h2>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <span>Picking status:</span>
              <StatusBadge status={activeTournament.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setTournamentStatus("locked")}
                disabled={statusBusy !== null || isLocked}
                className="rounded-lg bg-ink px-4 py-3 font-bold text-white transition hover:bg-court-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {statusBusy === "locked" ? "Locking…" : isLocked ? "Picking locked" : "Lock picking"}
              </button>
              <button
                onClick={() => setTournamentStatus("picking_open")}
                disabled={statusBusy !== null || isPickingOpen}
                className="rounded-lg border border-court-200 px-4 py-3 font-bold text-court-800 transition hover:bg-court-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {statusBusy === "picking_open" ? "Unlocking…" : isPickingOpen ? "Picking open" : "Unlock picking"}
              </button>
            </div>
            {statusMessage ? (
              <p
                className={
                  statusMessage.ok
                    ? "mt-3 text-sm font-bold text-court-700"
                    : "mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-clay-700"
                }
              >
                {statusMessage.text}
              </p>
            ) : null}
          </section>
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Bracket corrections</h2>
            <p className="mt-1 text-sm text-slate-600">
              Open the bracket editor, find the match, edit the player names or mark the winner, and corrections are locked against future sync overwrites.
            </p>
            <Link href={`/pools/${activePool.id}/admin/matches`} className="mt-4 inline-flex rounded-lg bg-ink px-4 py-2 font-bold text-white">
              Open bracket editor
            </Link>
          </section>
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Submission tracker</h2>
            <p className="mt-1 text-sm text-slate-600">Removing a member deletes their bracket and takes them off the roster.</p>
            <div className="mt-4 space-y-2">
              {poolBrackets.length === 0 && membersWithoutBracket.length === 0 ? (
                <p className="text-sm text-slate-500">No members yet.</p>
              ) : null}
              {poolBrackets.map((bracket) => (
                <div key={bracket.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 truncate font-semibold">{profileName(bracket.userId)}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold capitalize text-slate-600">{bracket.status}</span>
                    {bracket.userId === activePool.commissionerUserId ? null : (
                      <button
                        type="button"
                        onClick={() => removeMember(bracket.userId, profileName(bracket.userId))}
                        disabled={deletingUserId === bracket.userId}
                        aria-label={`Remove ${profileName(bracket.userId)} from the bracket`}
                        className="inline-flex items-center gap-1 rounded-lg border border-clay-300 bg-white px-2.5 py-1.5 text-xs font-bold text-clay-700 transition hover:bg-clay-100 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> {deletingUserId === bracket.userId ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {membersWithoutBracket.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 truncate font-semibold">{profileName(member.userId)}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-bold text-slate-400">not started</span>
                    {member.userId === activePool.commissionerUserId ? null : (
                      <button
                        type="button"
                        onClick={() => removeMember(member.userId, profileName(member.userId))}
                        disabled={deletingUserId === member.userId}
                        aria-label={`Remove ${profileName(member.userId)} from the bracket`}
                        className="inline-flex items-center gap-1 rounded-lg border border-clay-300 bg-white px-2.5 py-1.5 text-xs font-bold text-clay-700 transition hover:bg-clay-100 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> {deletingUserId === member.userId ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {deleteMessage ? (
              <p
                className={
                  deleteMessage.ok
                    ? "mt-3 text-sm font-bold text-court-700"
                    : "mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-clay-700"
                }
              >
                {deleteMessage.text}
              </p>
            ) : null}
          </section>
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-black">Scoring</h2>
            <p className="mt-1 text-sm text-slate-600">Points awarded per correct pick in each round. Set these before the tournament starts.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scoringRounds.map((round) => (
                <label key={round.id} className="grid gap-1 text-sm font-semibold text-slate-700">
                  {round.roundName}
                  <input
                    type="number"
                    min={0}
                    className="rounded-lg border border-slate-200 px-3 py-2"
                    value={round.pointsPerCorrectPick}
                    onChange={(event) =>
                      setScoringRounds((items) =>
                        items.map((item) => item.id === round.id ? { ...item, pointsPerCorrectPick: Number(event.target.value) } : item)
                      )
                    }
                  />
                </label>
              ))}
            </div>
            {scoringError ? <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{scoringError}</p> : null}
            <button
              onClick={saveScoring}
              disabled={scoringSave === "saving"}
              className="mt-4 rounded-lg bg-court-700 px-4 py-3 font-bold text-white disabled:bg-slate-300"
            >
              {scoringSave === "saving" ? "Saving..." : scoringSave === "saved" ? "Saved" : "Save scoring"}
            </button>
          </section>
        </div>
      </main>
    </AppFrame>
  );
}

function Metric({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-court-200 bg-white p-4 shadow-sm">
      <div className="text-court-700">{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className={small ? "mt-1 text-sm font-black" : "mt-1 text-2xl font-black"}>{value}</p>
    </div>
  );
}
