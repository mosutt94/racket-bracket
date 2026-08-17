"use client";

import { CalendarClock, CheckCircle2, Lock, LocateFixed, Save, Unlock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { BracketBoard } from "@/components/BracketBoard";
import { PageLoading } from "@/components/PageLoading";
import { PoolNav } from "@/components/PoolNav";
import { getCachedAppState, getCurrentUserForState, isPoolCommissioner, loadAppState, refreshTournamentMatches } from "@/lib/app-state-client";
import { pickWinner } from "@/lib/services/bracket-service";
import { getSlamShortLabel } from "@/lib/services/bracket-shell-service";
import { effectivePoolRounds, findTournamentForPool, isDrawPublished, isPoolPickingClosed } from "@/lib/state-helpers";
import { useAutoSync } from "@/lib/use-auto-sync";
import type { AppState, Bracket, BracketLiveScore } from "@/lib/types";
import { createUuid } from "@/lib/uuid";

// Deadlines are shown in ET (the Slams' own broadcast timezone), matching the
// admin page's auto-lock label. Returns null for an unparseable stamp so callers
// can fall back rather than render "Invalid Date".
function formatDeadline(deadline: string): string | null {
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

// Seed the first render from cached state so navigating back to your bracket is
// instant instead of flashing blank. Only seed when a real bracket already
// exists — a brand-new bracket would need a generated id that must match the one
// the fresh load creates, so we let that one case load normally.
function deriveCachedInitial(poolId: string): { state: AppState | null; bracket: Bracket | null } {
  const cached = getCachedAppState(poolId);
  if (!cached) return { state: null, bracket: null };
  const tournament = findTournamentForPool(cached, poolId);
  if (!tournament) return { state: null, bracket: null };
  const user = getCurrentUserForState(cached);
  const serverBracket = cached.brackets.find(
    (item) => item.poolId === poolId && item.tournamentId === tournament.id && item.userId === user.id
  );
  if (!serverBracket) return { state: null, bracket: null };
  return { state: cached, bracket: serverBracket };
}

// Apply a freshly-loaded server state without clobbering the picks the user is
// actively making. Background reloads (auto-sync, initial load) refresh match
// results + everyone's scores, but this page is the sole writer of the user's
// own bracket picks — so once the user has started editing (`userHasEdited`),
// we keep their on-screen picks and only take the rest of the fresh state.
function mergePreservingPicks(
  prev: AppState | null,
  fresh: AppState,
  myBracketId: string | null,
  userHasEdited: boolean
): AppState {
  if (!prev || !myBracketId || !userHasEdited) return fresh;
  const myPicks = prev.bracketPicks.filter((pick) => pick.bracketId === myBracketId);
  return {
    ...fresh,
    bracketPicks: [...fresh.bracketPicks.filter((pick) => pick.bracketId !== myBracketId), ...myPicks]
  };
}

export default function MyBracketPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(() => deriveCachedInitial(params.poolId).state);
  const [bracket, setBracket] = useState<Bracket | null>(() => deriveCachedInitial(params.poolId).bracket);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "submitted" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const [liveScores, setLiveScores] = useState<Record<string, BracketLiveScore>>({});
  const changeVersion = useRef(0);
  const saveRequestId = useRef(0);
  // Id of the bracket this user is editing. Read inside background reloads
  // (auto-sync) to carry the user's own picks across a server refresh —
  // this page is the sole writer of those picks, so the server can never
  // hold a newer version of them than what's on screen.
  const activeBracketIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadAppState(params.poolId).then((loaded) => {
      const tournament = findTournamentForPool(loaded, params.poolId);
      if (!tournament) return;
      const user = getCurrentUserForState(loaded);
      const serverBracket = loaded.brackets.find((item) => item.poolId === params.poolId && item.tournamentId === tournament.id && item.userId === user.id);
      const nextBracket = serverBracket ?? {
        id: createUuid(),
        poolId: params.poolId,
        tournamentId: tournament.id,
        userId: user.id,
        submittedAt: null,
        lockedAt: null,
        totalScore: 0,
        status: "draft" as const
      };
      const withBracket = serverBracket ? loaded : { ...loaded, brackets: [...loaded.brackets, nextBracket] };
      // If the user already started picking while this initial load was in
      // flight, don't wipe those picks — carry them over.
      activeBracketIdRef.current = nextBracket.id;
      setState((prev) => mergePreservingPicks(prev, withBracket, nextBracket.id, changeVersion.current > 0));
      setBracket(nextBracket);
    });
  }, [params.poolId]);

  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  useAutoSync(tournament, {
    onSynced: async () => {
      // Delta refresh: merges only changed matches into the cached state (a few
      // KB per tick) — picks are preserved the same way as a full reload was.
      const fresh = await refreshTournamentMatches(params.poolId);
      setState((prev) => mergePreservingPicks(prev, fresh, activeBracketIdRef.current, changeVersion.current > 0));
    }
  });
  const matches = useMemo(() => state && tournament ? state.matches.filter((match) => match.tournamentId === tournament.id) : [], [state, tournament]);
  const rounds = useMemo(() => state && tournament ? effectivePoolRounds(state, params.poolId, tournament.id) : [], [state, tournament, params.poolId]);
  const activeBracket = state && bracket ? state.brackets.find((item) => item.id === bracket.id) ?? bracket : null;
  activeBracketIdRef.current = activeBracket?.id ?? activeBracketIdRef.current;

  useEffect(() => {
    if (!tournament) return;
    let cancelled = false;

    async function loadLiveScores() {
      try {
        const response = await fetch(`/api/live-scores?tournamentId=${tournament!.id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !result.ok || cancelled) return;
        const nextScores = Object.fromEntries((result.scores ?? []).map((score: BracketLiveScore) => [score.matchId, score]));
        setLiveScores(nextScores);
      } catch {
        if (!cancelled) setLiveScores({});
      }
    }

    loadLiveScores();
    const interval = window.setInterval(loadLiveScores, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [tournament]);

  useEffect(() => {
    if (!dirty || !state || !tournament || !activeBracket || activeBracket.status !== "draft") return;
    const timer = window.setTimeout(() => {
      persist("draft");
    }, 900);
    return () => window.clearTimeout(timer);
  // persist is a function declaration below; these values are the autosave trigger surface.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, state, tournament, activeBracket]);

  // App-shell: lock the document so only the bracket scrolls. With nothing to
  // scroll at the page level, the mobile browser toolbar stops hiding/showing,
  // giving a contained, app-like feel.
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  if (!state || !tournament || !bracket || !activeBracket) return <PageLoading />;
  // userLocked = the player froze it (their padlock). pickingClosed = the
  // commissioner/tournament closed picking (can't be reopened by the player).
  const userLocked = activeBracket.status !== "draft";
  const pickingClosed = isPoolPickingClosed(state, params.poolId);
  const drawPublished = isDrawPublished(state, tournament);
  const locked = userLocked || pickingClosed;
  const pickedCount = matches.filter((match) => state.bracketPicks.some((pick) => pick.bracketId === activeBracket.id && pick.matchId === match.id)).length;
  const sortedMatches = [...matches].sort((a, b) => a.roundNumber - b.roundNumber || a.matchNumber - b.matchNumber);
  const nextMissingMatch = sortedMatches.find((match) => !state.bracketPicks.some((pick) => pick.bracketId === activeBracket.id && pick.matchId === match.id));

  function choose(matchId: string, playerId: string) {
    if (!state || !activeBracket) return;
    changeVersion.current += 1;
    const bracketId = activeBracket.id;
    const nextState = { ...state!, bracketPicks: pickWinner({ bracketId, matchId, playerId, matches, picks: state!.bracketPicks }) };
    setState(nextState);
    setSaveStatus("idle");
    setDirty(true);
  }

  function jumpToNextMissingPick() {
    if (!nextMissingMatch) return;
    setHighlightedMatchId(nextMissingMatch.id);
    window.setTimeout(() => {
      document.getElementById(`match-${nextMissingMatch.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center"
      });
    }, 20);
    window.setTimeout(() => setHighlightedMatchId(null), 2200);
  }

  async function persist(status: "draft" | "locked") {
    if (!state || !activeBracket) return;
    const requestId = saveRequestId.current + 1;
    const savedChangeVersion = changeVersion.current;
    saveRequestId.current = requestId;
    setSaveStatus("saving");
    const now = new Date().toISOString();
    const targetBracket: Bracket =
      status === "locked"
        ? { ...activeBracket, status: "locked", lockedAt: now, submittedAt: activeBracket.submittedAt ?? now }
        : { ...activeBracket, status: "draft", lockedAt: null };
    const picks = state.bracketPicks
      .filter((pick) => pick.bracketId === activeBracket.id)
      .map((pick) => ({ matchId: pick.matchId, pickedWinnerPlayerId: pick.pickedWinnerPlayerId }));

    try {
      const response = await fetch("/api/brackets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracketId: activeBracket.id,
          poolId: activeBracket.poolId,
          tournamentId: activeBracket.tournamentId,
          userId: activeBracket.userId,
          status,
          submittedAt: targetBracket.submittedAt,
          lockedAt: targetBracket.lockedAt,
          picks
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not save bracket.");
      if (requestId !== saveRequestId.current || savedChangeVersion !== changeVersion.current) return;

      const nextState = {
        ...state,
        brackets: state.brackets.map((item) => item.id === activeBracket.id ? targetBracket : item),
        bracketPicks: [
          ...state.bracketPicks.filter((pick) => pick.bracketId !== activeBracket.id),
          ...(result.picks ?? state.bracketPicks.filter((pick) => pick.bracketId === activeBracket.id))
        ]
      };
      setState(nextState);
      setBracket(targetBracket);
      setSaveStatus("saved");
      setDirty(false);
    } catch {
      if (requestId !== saveRequestId.current) return;
      setSaveStatus("error");
    }
  }

  const canSaveDraft = !locked && saveStatus === "error";
  const saveLabel = saveStatus === "saving" || dirty ? "Saving..." : saveStatus === "error" ? "Retry save" : "Saved";
  const SaveButtonIcon = dirty || saveStatus === "saving" || saveStatus === "error" ? Save : CheckCircle2;

  // ESPN doesn't publish a Grand Slam draw until a few days before round 1, so a
  // pool can exist with picking open while all 128 slots still read "TBD". Show
  // the waiting room instead of a bracket of placeholders: picks made now would
  // have to be wiped for every pool when the real draw is imported.
  if (!drawPublished) {
    const deadlineLabel = tournament.pickingDeadline ? formatDeadline(tournament.pickingDeadline) : null;
    return (
      <AppFrame compact slam={tournament.slamType}>
        <main className="flex min-h-[100dvh] flex-col px-2 pt-1 sm:px-3">
          <div className="mb-1 shrink-0">
            <PoolNav poolId={params.poolId} compact showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-md rounded-2xl border border-court-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-court-100 text-court-700">
                <CalendarClock size={24} />
              </div>
              <h1 className="text-xl font-black text-ink">
                The {getSlamShortLabel(tournament.slamType, tournament.year, tournament.gender)} draw isn&apos;t out yet
              </h1>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                Tennis draws are announced a few days before play begins. Once it&apos;s published, all 128 players
                appear here and you can fill in your bracket.
              </p>
              {deadlineLabel ? (
                <p className="mt-4 rounded-lg bg-court-50 px-3 py-2 text-sm font-bold text-court-800">
                  Picks are due {deadlineLabel}
                </p>
              ) : null}
              <p className="mt-4 text-xs font-semibold text-slate-400">
                Nothing to do right now — we&apos;ll have the bracket ready when the draw lands.
              </p>
            </div>
          </div>
        </main>
      </AppFrame>
    );
  }

  return (
    <AppFrame compact slam={tournament?.slamType}>
      <main className="flex h-[100dvh] flex-col overflow-hidden px-2 pt-1 sm:px-3">
        <div className="mb-1 shrink-0">
          <PoolNav poolId={params.poolId} compact showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
          <BracketBoard
            bracketId={activeBracket.id}
            slamType={tournament.slamType}
            mode={locked ? "review" : "picking"}
            locked={locked}
            title={getSlamShortLabel(tournament.slamType, tournament.year, tournament.gender)}
            submitted={locked}
            matches={matches}
            players={state.players}
            rounds={rounds}
            picks={state.bracketPicks}
            highlightedMatchId={highlightedMatchId}
            pickedCount={pickedCount}
            totalPicks={matches.length}
            liveScores={liveScores}
            onPick={choose}
          />
        </div>
        <div className="shrink-0 border-t border-court-200 bg-white px-2 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] sm:px-3">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            {!locked && nextMissingMatch ? (
              <button
                type="button"
                onClick={jumpToNextMissingPick}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-3 text-sm font-bold text-white"
                aria-label="Jump to next pick"
              >
                <LocateFixed size={16} /> Next Pick
              </button>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {!locked ? (
                <button
                  onClick={() => persist("draft")}
                  disabled={!canSaveDraft}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-3 text-sm font-bold text-court-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  <SaveButtonIcon size={18} /> <span className="max-[359px]:hidden">{saveLabel}</span>
                </button>
              ) : null}
              {pickingClosed ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-3 text-sm font-black text-slate-500">
                  <Lock size={16} /> Picks locked
                </span>
              ) : userLocked ? (
                <button
                  onClick={() => persist("draft")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-court-300 bg-white px-4 py-3 text-sm font-black text-court-800 shadow-sm transition hover:bg-court-50"
                >
                  <Unlock size={16} /> Unlock
                </button>
              ) : (
                <button
                  onClick={() => persist("locked")}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-court-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-court-900"
                >
                  <Lock size={16} /> Lock
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </AppFrame>
  );
}
