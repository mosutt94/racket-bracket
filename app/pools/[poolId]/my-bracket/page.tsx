"use client";

import { CheckCircle2, LocateFixed, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { BracketBoard } from "@/components/BracketBoard";
import { PoolNav } from "@/components/PoolNav";
import { getCurrentUserForState, isPoolCommissioner, loadAppState } from "@/lib/app-state-client";
import { isBracketComplete, pickWinner } from "@/lib/services/bracket-service";
import { getSlamShortLabel } from "@/lib/services/bracket-shell-service";
import { findTournamentForPool } from "@/lib/state-helpers";
import { useAutoSync } from "@/lib/use-auto-sync";
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
      setState(nextState);
      setBracket(nextBracket);
    });
  }, [params.poolId]);

  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  useAutoSync(tournament, {
    onSynced: async () => {
      const fresh = await loadAppState();
      setState(fresh);
    }
  });
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

  if (!state || !tournament || !bracket || !activeBracket) return null;
  const locked = activeBracket.status !== "draft" || tournament.status !== "picking_open";
  const complete = isBracketComplete(activeBracket.id, matches, state.bracketPicks);
  const pickedCount = matches.filter((match) => state.bracketPicks.some((pick) => pick.bracketId === activeBracket.id && pick.matchId === match.id)).length;
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
    const targetBracket: Bracket =
      status === "submitted"
        ? { ...activeBracket, status: "submitted", submittedAt: activeBracket.submittedAt ?? new Date().toISOString() }
        : activeBracket;
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
      setSaveStatus(status === "submitted" ? "submitted" : "saved");
      setDirty(false);
    } catch {
      if (requestId !== saveRequestId.current) return;
      setSaveStatus("error");
    }
  }

  async function submit() {
    if (!state || !activeBracket) return;
    await persist("submitted");
  }

  const submitted = activeBracket.status === "submitted" || activeBracket.status === "locked";
  const submitLabel = submitted ? "Submitted" : "Submit";
  const canSaveDraft = !locked && saveStatus === "error";
  const saveLabel = saveStatus === "saving" || dirty ? "Saving..." : saveStatus === "error" ? "Retry save" : "Saved";
  const SaveButtonIcon = dirty || saveStatus === "saving" || saveStatus === "error" ? Save : CheckCircle2;

  return (
    <AppFrame compact>
      <main className="flex h-[100dvh] flex-col overflow-hidden px-2 pt-1 sm:px-3">
        <div className="mb-1 shrink-0">
          <PoolNav poolId={params.poolId} compact showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain">
          <div className="mb-2 hidden rounded-lg border border-court-200 bg-white p-2 shadow-sm lg:block">
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
          <BracketBoard
            bracketId={activeBracket.id}
            mode={locked ? "review" : "picking"}
            locked={locked}
            title={getSlamShortLabel(tournament.slamType, tournament.year, tournament.gender)}
            submitted={submitted}
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
        {!submitted ? (
          <div className="shrink-0 border-t border-court-200 bg-white px-2 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] sm:px-3">
            <div className="mx-auto flex max-w-5xl items-center gap-2">
              {nextMissingMatch ? (
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
                <button
                  onClick={() => persist("draft")}
                  disabled={!canSaveDraft}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-3 text-sm font-bold text-court-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  <SaveButtonIcon size={18} /> <span className="max-[359px]:hidden">{saveLabel}</span>
                </button>
                <button
                  onClick={submit}
                  disabled={!complete || locked}
                  className="shrink-0 rounded-lg bg-court-700 px-4 py-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {submitLabel}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppFrame>
  );
}
