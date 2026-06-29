"use client";

import Link from "next/link";
import { CalendarClock, Copy, Download, Eraser, KeyRound, Lock, Settings, Share2, ShieldAlert, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PageLoading } from "@/components/PageLoading";
import { PasswordField } from "@/components/PasswordField";
import { PoolNav } from "@/components/PoolNav";
import { StatusBadge } from "@/components/StatusBadge";
import { getCachedAppState, getCurrentUserForState, isPoolCommissioner, loadAppState } from "@/lib/app-state-client";
import { saveCurrentUser } from "@/lib/current-user";
import { validatePassword } from "@/lib/password-rules";
import { findTournamentForPool, isPickingClosed } from "@/lib/state-helpers";
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
  const [state, setState] = useState<AppState | null>(() => getCachedAppState(params.poolId));
  const [busy, setBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importStatus, setImportStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusBusy, setStatusBusy] = useState<TournamentStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [scoringRounds, setScoringRounds] = useState<TournamentRound[]>([]);
  const [scoringSave, setScoringSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scoringError, setScoringError] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [roleBusyUserId, setRoleBusyUserId] = useState<string | null>(null);
  const [clearingUserId, setClearingUserId] = useState<string | null>(null);
  // First-time password set (for commissioners migrating from no password).
  const [setPw, setSetPw] = useState("");
  const [setPwConfirm, setSetPwConfirm] = useState("");
  const [setPwInvite, setSetPwInvite] = useState("");
  const [setPwState, setSetPwState] = useState<"idle" | "saving">("idle");
  const [setPwMessage, setSetPwMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Change password (for commissioners who already have one).
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [changePwState, setChangePwState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [changePwError, setChangePwError] = useState<string | null>(null);
  // Verified commissioner session (the httpOnly cookie userId, or null if none).
  // undefined = not checked yet. Re-auth prompt (for a password-protected
  // commissioner whose session isn't established on this device/browser).
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);
  const [reauthPw, setReauthPw] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  // Origin for building the absolute invite link (window is only available
  // after mount, so keep it in state to avoid an SSR hydration mismatch).
  const [origin, setOrigin] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    loadAppState(params.poolId).then(setState);
    fetch("/api/auth/commissioner-status")
      .then((r) => r.json())
      .then((d) => setSessionUserId(d.userId ?? null))
      .catch(() => setSessionUserId(null));
  }, [params.poolId]);

  // Keep the editable scoring rows in sync with loaded state.
  useEffect(() => {
    if (!state) return;
    const t = findTournamentForPool(state, params.poolId);
    if (!t) return;
    setScoringRounds(
      state.rounds.filter((round) => round.tournamentId === t.id).sort((a, b) => a.roundNumber - b.roundNumber)
    );
  }, [state, params.poolId]);

  if (!state) return <PageLoading />;

  const pool = state.pools.find((item) => item.id === params.poolId);
  const tournament = findTournamentForPool(state, params.poolId);
  if (!pool || !tournament) return null;
  const activePool = pool;
  const activeTournament = tournament;
  const me = getCurrentUserForState(state);
  // Co-commissioners (members promoted to the "commissioner" role) get full powers.
  const isCommissioner = isPoolCommissioner(state, params.poolId);
  const hasPassword = Boolean(me.hasPassword);
  const roleOf = (userId: string) =>
    userId === activePool.commissionerUserId
      ? "commissioner"
      : state.poolMembers.find((member) => member.poolId === activePool.id && member.userId === userId)?.role ?? "member";
  // A password-protected commissioner whose verified session isn't established
  // on this device — admin actions would fail until they confirm their password.
  const needsReauth = isCommissioner && hasPassword && sessionUserId !== undefined && sessionUserId !== me.id;
  const isPickingOpen = activeTournament.status === "picking_open";
  const isLocked = activeTournament.status === "locked";
  // Scheduled auto-lock: while picking is open, picks freeze automatically once
  // the picking deadline passes (so play can't start with brackets still open).
  const autoLockAt = isPickingOpen && activeTournament.pickingDeadline ? new Date(activeTournament.pickingDeadline) : null;
  const autoLockValid = autoLockAt !== null && !Number.isNaN(autoLockAt.getTime());
  const autoLockLabel = autoLockValid
    ? autoLockAt!.toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;
  const autoLockPassed = autoLockValid && Date.now() >= autoLockAt!.getTime();
  // Once play begins (picks closed) the shared-per-Slam destructive actions are
  // frozen — scoring edits and the clear-all-picks re-import. The server rejects
  // them too; these flags just reflect that in the UI.
  const tournamentStarted = isPickingClosed(activeTournament);
  const members = state.poolMembers.filter((member) => member.poolId === activePool.id);
  // Drive the submission tracker off the brackets that actually exist for this
  // pool, not the member list. The two can drift apart (email-based identity can
  // split a person across profile ids), and we must be able to delete every real
  // bracket regardless of whether it maps cleanly to a member row.
  const poolBrackets = state.brackets.filter((item) => item.poolId === activePool.id && item.tournamentId === activeTournament.id);
  const profileName = (userId: string) => state.profiles.find((profile) => profile.id === userId)?.displayName ?? "Unknown player";
  const profileEmail = (userId: string) => state.profiles.find((profile) => profile.id === userId)?.email ?? null;
  // A bracket is complete once every match in the draw has a pick filled in.
  const totalMatches = state.matches.filter((match) => match.tournamentId === activeTournament.id).length;
  const filledByBracket = new Map<string, number>();
  for (const pick of state.bracketPicks) {
    if (pick.pickedWinnerPlayerId) filledByBracket.set(pick.bracketId, (filledByBracket.get(pick.bracketId) ?? 0) + 1);
  }
  const isBracketComplete = (bracketId: string) => totalMatches > 0 && (filledByBracket.get(bracketId) ?? 0) >= totalMatches;
  const completeCount = poolBrackets.filter((bracket) => isBracketComplete(bracket.id)).length;
  // Unified roster: every member, plus any bracket owner not in the member list
  // (email-identity drift), so every real participant is manageable.
  const bracketByUser = new Map(poolBrackets.map((bracket) => [bracket.userId, bracket]));
  const roster = Array.from(new Set([...members.map((m) => m.userId), ...poolBrackets.map((b) => b.userId)]))
    .map((userId) => ({
      userId,
      bracket: bracketByUser.get(userId) ?? null,
      role: roleOf(userId),
      isMainCommissioner: userId === activePool.commissionerUserId
    }))
    .sort((a, b) => profileName(a.userId).localeCompare(profileName(b.userId)));
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
      setState(await loadAppState(params.poolId));
      setStatusMessage({ ok: true, text: status === "picking_open" ? "Picking is now open." : "Picking is now locked." });
    } catch (error) {
      setStatusMessage({ ok: false, text: error instanceof Error ? error.message : "Could not update status." });
    } finally {
      setStatusBusy(null);
    }
  }

  async function importDraw(resetExistingPicks = false) {
    setImportBusy(true);
    setImportStatus(null);
    try {
      const response = await fetch("/api/admin/live-feed/import-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: activeTournament.id,
          slamType: activeTournament.slamType,
          year: activeTournament.year,
          gender: activeTournament.gender,
          resetExistingPicks
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not import the draw.");
      setState(await loadAppState(params.poolId));
      let text: string;
      if (result.mode === "seeds") {
        // Picks already exist, so we only refreshed seeds — nobody's picks touched.
        text = `Pulled in the latest seeds — picks were left untouched (${result.seedsUpdated} seeds set).`;
      } else if (result.warning) {
        text = `Imported, but: ${result.warning}`;
      } else {
        text = "Draw imported from ESPN. If you still see TBD, ESPN hasn't published the bracket yet — try again later.";
      }
      setImportStatus({ ok: true, text });
    } catch (error) {
      setImportStatus({ ok: false, text: error instanceof Error ? error.message : "Could not import the draw." });
    } finally {
      setImportBusy(false);
    }
  }

  function confirmResetImport() {
    if (window.confirm("This wipes the whole draw AND clears ALL picks for this tournament so everyone re-picks. Only needed if the bracket itself was wrong. This can't be undone. Continue?")) {
      importDraw(true);
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
    setState(await loadAppState(params.poolId));
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
      setState(await loadAppState(params.poolId));
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
      setState(await loadAppState(params.poolId));
      setDeleteMessage({ ok: true, text: `Removed ${displayName}.` });
    } catch (error) {
      setDeleteMessage({ ok: false, text: error instanceof Error ? error.message : "Could not remove member." });
    } finally {
      setDeletingUserId(null);
    }
  }

  async function clearBracket(userId: string, displayName: string) {
    if (!window.confirm(`Clear ${displayName}'s bracket? This wipes all their picks but keeps them in the bracket so they can re-fill.`)) return;
    setClearingUserId(userId);
    setDeleteMessage(null);
    try {
      const response = await fetch("/api/admin/clear-bracket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: activePool.id, userId })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not clear bracket.");
      setState(await loadAppState(params.poolId));
      setDeleteMessage({ ok: true, text: `Cleared ${displayName}'s picks.` });
    } catch (error) {
      setDeleteMessage({ ok: false, text: error instanceof Error ? error.message : "Could not clear bracket." });
    } finally {
      setClearingUserId(null);
    }
  }

  async function setMemberRole(userId: string, displayName: string, role: "commissioner" | "member") {
    if (role === "commissioner" && !window.confirm(`Make ${displayName} a co-commissioner? They'll get full admin access to this bracket.`)) return;
    setRoleBusyUserId(userId);
    setDeleteMessage(null);
    try {
      const response = await fetch("/api/admin/member-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId: activePool.id, userId, role })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not update role.");
      setState(await loadAppState(params.poolId));
      setDeleteMessage({ ok: true, text: role === "commissioner" ? `${displayName} is now a co-commissioner.` : `${displayName} is no longer a co-commissioner.` });
    } catch (error) {
      setDeleteMessage({ ok: false, text: error instanceof Error ? error.message : "Could not update role." });
    } finally {
      setRoleBusyUserId(null);
    }
  }

  async function reauth() {
    if (!reauthPw) {
      setReauthError("Enter your password.");
      return;
    }
    setReauthBusy(true);
    setReauthError(null);
    try {
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: me.email, password: reauthPw })
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.profile) throw new Error(result.error ?? "That password doesn't match.");
      setReauthPw("");
      setSessionUserId(me.id);
    } catch (error) {
      setReauthError(error instanceof Error ? error.message : "That password doesn't match.");
    } finally {
      setReauthBusy(false);
    }
  }

  async function setFirstPassword() {
    const validationError = validatePassword(setPw);
    if (validationError) {
      setSetPwMessage({ ok: false, text: validationError });
      return;
    }
    if (setPw !== setPwConfirm) {
      setSetPwMessage({ ok: false, text: "Passwords don't match." });
      return;
    }
    setSetPwState("saving");
    setSetPwMessage(null);
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: me.email, inviteCode: setPwInvite, newPassword: setPw })
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.profile) throw new Error(result.error ?? "Could not set your password.");
      saveCurrentUser(result.profile);
      setSetPw("");
      setSetPwConfirm("");
      setSetPwInvite("");
      setSetPwMessage({ ok: true, text: "Password set. You'll use it next time you sign in." });
      setState(await loadAppState(params.poolId));
    } catch (error) {
      setSetPwMessage({ ok: false, text: error instanceof Error ? error.message : "Could not set your password." });
    } finally {
      setSetPwState("idle");
    }
  }

  async function changePassword() {
    const validationError = validatePassword(newPw);
    if (validationError) {
      setChangePwState("error");
      setChangePwError(validationError);
      return;
    }
    if (newPw !== newPwConfirm) {
      setChangePwState("error");
      setChangePwError("New passwords don't match.");
      return;
    }
    setChangePwState("saving");
    setChangePwError(null);
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: me.email, currentPassword: curPw, newPassword: newPw })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not update your password.");
      if (result.profile) saveCurrentUser(result.profile);
      setCurPw("");
      setNewPw("");
      setNewPwConfirm("");
      setChangePwState("saved");
    } catch (error) {
      setChangePwState("error");
      setChangePwError(error instanceof Error ? error.message : "Could not update your password.");
    }
  }

  return (
    <AppFrame compact slam={activeTournament.slamType}>
      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PoolNav poolId={activePool.id} showAccount isCommissioner={isCommissioner} />
        {needsReauth ? (
          <section className="mb-4 mt-1 rounded-xl border border-court-300 bg-court-50 p-5">
            <div className="flex items-center gap-2 text-court-700">
              <KeyRound size={20} />
              <h2 className="text-lg font-black text-ink">Confirm your password to manage this bracket</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              You&apos;re signed in, but this device hasn&apos;t verified your commissioner password yet — so admin actions (sync, import, lock picks) are blocked until you confirm it.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:max-w-md">
              <PasswordField label="Commissioner password" value={reauthPw} onChange={setReauthPw} onEnter={reauth} />
              {reauthError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{reauthError}</p> : null}
              <button
                onClick={reauth}
                disabled={reauthBusy}
                className="rounded-lg bg-court-700 px-4 py-3 font-bold text-white transition hover:bg-court-900 disabled:opacity-50 sm:w-auto sm:self-start sm:px-6"
              >
                {reauthBusy ? "Confirming…" : "Confirm password"}
              </button>
            </div>
          </section>
        ) : null}
        {isCommissioner && !hasPassword ? (
          <section className="mb-4 mt-1 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-800">
              <ShieldAlert size={20} />
              <h2 className="text-lg font-black">Secure your commissioner account</h2>
            </div>
            <p className="mt-1 text-sm text-amber-800">
              Anyone who knows your email can manage this bracket right now. Set a password so only you can lock picks and edit results.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <PasswordField label="New password" value={setPw} onChange={setSetPw} />
              <PasswordField label="Confirm password" value={setPwConfirm} onChange={setSetPwConfirm} />
              <label className="block text-sm font-semibold text-slate-700">
                Bracket invite code
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 uppercase"
                  value={setPwInvite}
                  onChange={(event) => setSetPwInvite(event.target.value)}
                  placeholder={activePool.inviteCode}
                />
              </label>
            </div>
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Enter this bracket&apos;s invite code ({activePool.inviteCode}) to confirm it&apos;s really you.
            </p>
            {setPwMessage ? (
              <p className={setPwMessage.ok ? "mt-3 text-sm font-bold text-court-700" : "mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-clay-700"}>
                {setPwMessage.text}
              </p>
            ) : null}
            <button
              onClick={setFirstPassword}
              disabled={setPwState === "saving"}
              className="mt-4 rounded-lg bg-ink px-4 py-3 font-bold text-white transition hover:bg-court-900 disabled:opacity-50"
            >
              {setPwState === "saving" ? "Setting…" : "Set password"}
            </button>
          </section>
        ) : null}
        <div className="mb-4 mt-1">
          <p className="text-xs font-bold uppercase tracking-wide text-court-700 sm:text-sm">Commissioner dashboard</p>
          <h1 className="text-2xl font-black text-ink sm:text-3xl">{activePool.name}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric icon={<Users />} label="Members" value={members.length} />
          <Metric icon={<Lock />} label="Complete" value={`${completeCount}/${members.length}`} />
          <Metric icon={<CalendarClock />} label="Draw status" value={activeInstance?.status.replace("_", " ") ?? activeTournament.status} small />
          <Metric icon={<Settings />} label="Last sync" value={formatDateTime(activeTournament.lastSyncedAt ?? activeInstance?.lastSyncedAt)} small />
        </div>
        <section className="mt-6 rounded-xl border border-court-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-court-700">
            <Share2 size={18} />
            <p className="text-xs font-black uppercase tracking-wide">Invite friends</p>
          </div>
          <h2 className="mt-2 text-xl font-black text-ink">Share this bracket</h2>
          <p className="mt-1 text-sm text-slate-600">
            Send this link to anyone you want in {activePool.name}. They can join and fill out their bracket while picks are open.
          </p>
          <div className="mt-4 rounded-lg border border-court-200 bg-court-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-court-700">Invite link</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 truncate text-sm font-semibold text-court-900">
                {origin ? `${origin}/join/${activePool.inviteCode}` : `/join/${activePool.inviteCode}`}
              </p>
              <button
                onClick={async () => {
                  await copyText(`${window.location.origin}/join/${activePool.inviteCode}`);
                  setCopiedInvite(true);
                  window.setTimeout(() => setCopiedInvite(false), 1600);
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-2 text-sm font-bold text-court-800 hover:bg-court-100"
              >
                <Copy size={15} /> {copiedInvite ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">Invite code: {activePool.inviteCode}</p>
          </div>
        </section>
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
                    ? `Updated ${syncStatus.matchesUpdated ?? 0} matches and applied ${syncStatus.winnersApplied ?? 0} new results.`
                    : syncStatus.error ?? "Could not apply ESPN results."}
                </p>
              ) : null}
            </div>
          </section>
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2 text-court-700">
                  <Download size={18} />
                  <p className="text-xs font-black uppercase tracking-wide">Import draw</p>
                </div>
                <h2 className="mt-2 text-xl font-black text-ink">First-round matchups & seeds</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pull the first-round matchups and the player seeds from ESPN. Safe to run anytime — once people have picked, this only refreshes the seeds (ESPN adds them shortly after the draw) and never touches anyone&apos;s picks.
                </p>
              </div>
              <div className="grid gap-2 md:min-w-[220px]">
                <button onClick={() => importDraw(false)} disabled={importBusy} className="rounded-lg bg-ink px-4 py-3 font-bold text-white disabled:bg-slate-300">
                  {importBusy ? "Importing..." : "Import draw / refresh seeds"}
                </button>
                {/* Clearing all picks wipes every pool on this Slam — only ever
                    available before play starts; the server enforces this too. */}
                {tournamentStarted ? (
                  <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                    🔒 Re-importing the draw is locked once the tournament has started.
                  </p>
                ) : (
                  <button
                    onClick={confirmResetImport}
                    disabled={importBusy}
                    className="rounded-lg border border-clay-300 px-4 py-2 text-sm font-bold text-clay-700 transition hover:bg-clay-100 disabled:opacity-50"
                  >
                    Re-import &amp; clear all picks
                  </button>
                )}
              </div>
              {importStatus ? (
                <p className={importStatus.ok ? "mt-3 text-sm font-bold text-court-700" : "mt-3 text-sm font-bold text-clay-700"}>
                  {importStatus.text}
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
            {autoLockLabel ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {autoLockPassed
                  ? `Picks auto-locked ${autoLockLabel} ET (tournament start). Lock picking to make it permanent.`
                  : `Auto-locks ${autoLockLabel} ET — you don't have to lock manually.`}
              </p>
            ) : null}
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
            <h2 className="text-lg font-black">Player labels (Q / WC)</h2>
            <p className="mt-1 text-sm text-slate-600">
              ESPN doesn&apos;t supply qualifier/wild-card labels. Add them by hand — they show in the bracket where the seed number goes.
            </p>
            <Link href={`/pools/${activePool.id}/admin/labels`} className="mt-4 inline-flex rounded-lg bg-ink px-4 py-2 font-bold text-white">
              Edit Q / WC labels
            </Link>
          </section>
          <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black">Submission tracker</h2>
            <p className="mt-1 text-sm text-slate-600">Promote a member to co-commissioner for full admin access, clear a bracket to reset their picks, or remove them entirely.</p>
            <div className="mt-4 space-y-2">
              {roster.length === 0 ? <p className="text-sm text-slate-500">No members yet.</p> : null}
              {roster.map(({ userId, bracket, role, isMainCommissioner }) => {
                const name = profileName(userId);
                const email = profileEmail(userId);
                const isCo = role === "commissioner" && !isMainCommissioner;
                // You can't promote/demote or remove yourself, or touch the main commissioner.
                const canManage = !isMainCommissioner && userId !== me.id;
                const complete = bracket ? isBracketComplete(bracket.id) : false;
                return (
                  <div key={userId} className="flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{name}</span>
                      {email ? <span className="block truncate text-xs text-slate-500">{email}</span> : null}
                      {isMainCommissioner ? (
                        <span className="text-xs font-black uppercase tracking-wide text-court-700">Commissioner</span>
                      ) : isCo ? (
                        <span className="text-xs font-black uppercase tracking-wide text-court-700">Co-commissioner</span>
                      ) : null}
                    </span>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span
                        className={
                          !bracket
                            ? "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-400"
                            : complete
                              ? "rounded-full bg-court-100 px-2.5 py-1 text-xs font-black text-court-700"
                              : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
                        }
                      >
                        {!bracket ? "Not started" : complete ? "Complete" : "Incomplete"}
                      </span>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => setMemberRole(userId, name, isCo ? "member" : "commissioner")}
                          disabled={roleBusyUserId === userId}
                          className="inline-flex items-center gap-1 rounded-lg border border-court-200 bg-white px-2.5 py-1.5 text-xs font-bold text-court-800 transition hover:bg-court-50 disabled:opacity-50"
                        >
                          <ShieldCheck size={14} /> {roleBusyUserId === userId ? "Saving…" : isCo ? "Remove co-commish" : "Make co-commish"}
                        </button>
                      ) : null}
                      {bracket ? (
                        <button
                          type="button"
                          onClick={() => clearBracket(userId, name)}
                          disabled={clearingUserId === userId}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Eraser size={14} /> {clearingUserId === userId ? "Clearing…" : "Clear"}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => removeMember(userId, name)}
                          disabled={deletingUserId === userId}
                          aria-label={`Remove ${name} from the bracket`}
                          className="inline-flex items-center gap-1 rounded-lg border border-clay-300 bg-white px-2.5 py-1.5 text-xs font-bold text-clay-700 transition hover:bg-clay-100 disabled:opacity-50"
                        >
                          <Trash2 size={14} /> {deletingUserId === userId ? "Removing…" : "Remove"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
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
            {tournamentStarted ? (
              <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
                🔒 Scoring is locked because the tournament has started. It can&apos;t be changed once play is underway.
              </p>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scoringRounds.map((round) => (
                <label key={round.id} className="grid gap-1 text-sm font-semibold text-slate-700">
                  {round.roundName}
                  <input
                    type="number"
                    min={0}
                    disabled={tournamentStarted}
                    className="rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
            {!tournamentStarted ? (
              <button
                onClick={saveScoring}
                disabled={scoringSave === "saving"}
                className="mt-4 rounded-lg bg-court-700 px-4 py-3 font-bold text-white disabled:bg-slate-300"
              >
                {scoringSave === "saving" ? "Saving..." : scoringSave === "saved" ? "Saved" : "Save scoring"}
              </button>
            ) : null}
          </section>
          {isCommissioner && hasPassword ? (
            <section className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-court-700">
                <KeyRound size={18} />
                <h2 className="text-lg font-black text-ink">Commissioner password</h2>
              </div>
              <p className="mt-1 text-sm text-slate-600">Change the password you use to sign in and manage this bracket.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PasswordField label="Current password" value={curPw} onChange={setCurPw} />
                <PasswordField label="New password" value={newPw} onChange={setNewPw} />
                <PasswordField label="Confirm new password" value={newPwConfirm} onChange={setNewPwConfirm} />
              </div>
              {changePwState === "error" && changePwError ? (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{changePwError}</p>
              ) : changePwState === "saved" ? (
                <p className="mt-3 text-sm font-bold text-court-700">Password updated.</p>
              ) : null}
              <button
                onClick={changePassword}
                disabled={changePwState === "saving" || !curPw || !newPw}
                className="mt-4 rounded-lg bg-court-700 px-4 py-3 font-bold text-white disabled:bg-slate-300"
              >
                {changePwState === "saving" ? "Saving…" : changePwState === "saved" ? "Saved" : "Update password"}
              </button>
            </section>
          ) : null}
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

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
