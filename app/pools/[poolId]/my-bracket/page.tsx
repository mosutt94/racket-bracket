"use client";

import { CheckCircle2, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { BracketBoard } from "@/components/BracketBoard";
import { PoolNav } from "@/components/PoolNav";
import { getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { clearCurrentUser, saveState, updateBracketStatus } from "@/lib/demo-store";
import { isBracketComplete, pickWinner } from "@/lib/services/bracket-service";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, Bracket, BracketLiveScore } from "@/lib/types";
import { createUuid } from "@/lib/uuid";

export default function MyBracketPage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "submitted" | "error">("idle");
  const [dirty, setDirty] = useState(false);
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const [liveScores, setLiveScores] = useState<Record<string, BracketLiveScore>>({});
  const changeVersion = useRef(0);
  const saveRequestId = useRef(0);

  useEffect(() => {
    loadAppState().then((loaded) => {
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
      const nextState = serverBracket ? loaded : { ...loaded, brackets: [...loaded.brackets, nextBracket] };
      saveState(nextState);
      setState(nextState);
      setBracket(nextBracket);
    });
  }, [params.poolId]);

  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  const matches = useMemo(() => state && tournament ? state.matches.filter((match) => match.tournamentId === tournament.id) : [], [state, tournament]);
  const rounds = useMemo(() => state && tournament ? state.rounds.filter((round) => round.tournamentId === tournament.id) : [], [state, tournament]);
  const activeBracket = state && bracket ? state.brackets.find((item) => item.id === bracket.id) ?? bracket : null;

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

  if (!state || !tournament || !bracket || !activeBracket) return null;
  const locked = activeBracket.status !== "draft" || tournament.status !== "picking_open";
  const complete = isBracketComplete(activeBracket.id, matches, state.bracketPicks);
  const pickedCount = matches.filter((match) => state.bracketPicks.some((pick) => pick.bracketId === activeBracket.id && pick.matchId === match.id)).length;
  const remainingPicks = Math.max(0, matches.length - pickedCount);
  const sortedMatches = [...matches].sort((a, b) => a.roundNumber - b.roundNumber || a.matchNumber - b.matchNumber);
  const nextMissingMatch = sortedMatches.find((match) => !state.bracketPicks.some((pick) => pick.bracketId === activeBracket.id && pick.matchId === match.id));
  const roundProgress = [...rounds]
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .map((round) => {
      const roundMatches = matches.filter((match) => match.roundNumber === round.roundNumber);
      const roundPicked = roundMatches.filter((match) => state.bracketPicks.some((pick) => pick.bracketId === activeBracket.id && pick.matchId === match.id)).length;
      return { round, picked: roundPicked, total: roundMatches.length };
    });

  function choose(matchId: string, playerId: string) {
    if (!state || !activeBracket) return;
    changeVersion.current += 1;
    const bracketId = activeBracket.id;
    const nextState = { ...state!, bracketPicks: pickWinner({ bracketId, matchId, playerId, matches, picks: state!.bracketPicks }) };
    saveState(nextState);
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

  async function persist(status: "draft" | "submitted") {
    if (!state || !activeBracket) return;
    const requestId = saveRequestId.current + 1;
    const savedChangeVersion = changeVersion.current;
    saveRequestId.current = requestId;
    setSaveStatus("saving");
    const submittedBracket = status === "submitted"
      ? updateBracketStatus(state, activeBracket.id, "submitted").brackets.find((item) => item.id === activeBracket.id)
      : null;
    const targetBracket: Bracket = submittedBracket ?? activeBracket;
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
      saveState(nextState);
      setState(nextState);
      setBracket(targetBracket);
      setSaveStatus(status === "submitted" ? "submitted" : "saved");
      setDirty(false);
    } catch {
      if (requestId !== saveRequestId.current) return;
      setSaveStatus("error");
    }
  }

  async function submit() {
    if (!state || !activeBracket) return;
    const nextState = updateBracketStatus(state, activeBracket.id, "submitted");
    saveState(nextState);
    setState(nextState);
    await persist("submitted");
  }

  function signOut() {
    clearCurrentUser();
    window.location.href = "/";
  }

  const currentUser = getCurrentUserForState(state);
  const submitted = activeBracket.status === "submitted" || activeBracket.status === "locked";
  const submitLabel = submitted ? "Submitted" : remainingPicks > 0 ? `Submit (${remainingPicks} left)` : "Submit";
  const canSaveDraft = !locked && saveStatus === "error";
  const saveLabel = saveStatus === "saving" || dirty ? "Saving..." : saveStatus === "error" ? "Retry save" : "Saved";
  const SaveButtonIcon = dirty || saveStatus === "saving" || saveStatus === "error" ? Save : CheckCircle2;

  return (
    <AppFrame compact>
      <main className={`mx-auto max-w-none px-2 pt-1 sm:px-3 ${submitted ? "pb-2" : "pb-24"}`}>
        <div className="mb-1 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <PoolNav poolId={params.poolId} compact />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <p className="max-w-[180px] truncate text-sm font-bold text-slate-600">Hi, {currentUser.displayName}</p>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white sm:text-sm"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
        <div className="mb-1 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-court-700">My bracket</p>
              <p className="text-xs font-semibold text-slate-600">Status: {activeBracket.status}</p>
              {saveStatus === "saved" ? <p className="text-xs font-semibold text-court-700">Saved</p> : null}
              {saveStatus === "submitted" ? <p className="text-xs font-semibold text-court-700">Submitted</p> : null}
              {saveStatus === "error" ? <p className="text-xs font-semibold text-clay-700">Save failed</p> : null}
              {!submitted ? <p className="text-xs font-semibold text-slate-600">{pickedCount} of {matches.length} picks made</p> : null}
            </div>
            <h1 className="truncate text-lg font-black text-ink sm:text-xl">{tournament.name}</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => persist("draft")}
              disabled={!canSaveDraft}
              className="inline-flex items-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-2 text-sm font-bold text-court-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            >
              <SaveButtonIcon size={18} /> {saveLabel}
            </button>
            <button
              onClick={submit}
              disabled={!complete || locked}
              className="inline-flex items-center gap-2 rounded-lg bg-court-700 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitLabel}
            </button>
          </div>
        </div>
        <div className="mb-2 rounded-lg border border-court-100 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {roundProgress.map(({ round, picked, total }) => (
              <div
                key={round.id}
                className="rounded-lg bg-court-50 px-2.5 py-2"
              >
                <p className="truncate text-[11px] font-black text-ink">{round.roundName}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-court-700" style={{ width: `${total ? (picked / total) * 100 : 0}%` }} />
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-600">{picked}/{total}</p>
              </div>
            ))}
          </div>
        </div>
        {!submitted && remainingPicks > 0 ? (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
            Make every pick before submitting. {remainingPicks} picks left.
          </div>
        ) : null}
        {!submitted && complete ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-court-200 bg-court-50 px-3 py-2 text-sm font-bold text-court-900">
            <CheckCircle2 size={18} />
            All picks are in. Review your champion, then submit.
          </div>
        ) : null}
        {submitted ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-court-200 bg-court-50 px-3 py-2 text-sm font-bold text-court-900">
            <CheckCircle2 size={18} />
            Bracket submitted. Your picks are now read-only.
          </div>
        ) : null}
        <BracketBoard
          bracketId={activeBracket.id}
          mode={locked ? "review" : "picking"}
          locked={locked}
          matches={matches}
          players={state.players}
          rounds={rounds}
          picks={state.bracketPicks}
          highlightedMatchId={highlightedMatchId}
          pickedCount={pickedCount}
          totalPicks={matches.length}
          liveScores={liveScores}
          nextMissingAvailable={!submitted && Boolean(nextMissingMatch)}
          onNextMissing={jumpToNextMissingPick}
          onPick={choose}
        />
        {!submitted ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-court-100 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">
                  {complete ? "All picks are in" : `${remainingPicks} picks left`}
                </p>
                <p className="truncate text-xs font-semibold text-slate-500">
                  {complete ? "Review your champion, then submit." : `${pickedCount} of ${matches.length} picks made`}
                </p>
              </div>
              <button
                onClick={submit}
                disabled={!complete || locked}
                className="shrink-0 rounded-lg bg-court-700 px-5 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitLabel}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    </AppFrame>
  );
}
