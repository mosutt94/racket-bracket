"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleDot, Trophy, X } from "lucide-react";
import { getProjectedMatchPlayers } from "@/lib/services/bracket-service";
import { countryCodeToFlagEmoji } from "@/lib/country-flags";
import type { BracketLiveScore, BracketPick, Match, Player, ProviderMatchStatus, TournamentRound } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

interface BracketBoardProps {
  bracketId?: string;
  matches: Match[];
  players: Player[];
  rounds: TournamentRound[];
  picks?: BracketPick[];
  mode: "real" | "picking" | "review";
  locked?: boolean;
  title?: string;
  highlightedMatchId?: string | null;
  pickedCount?: number;
  totalPicks?: number;
  liveScores?: Record<string, BracketLiveScore>;
  onPick?: (matchId: string, playerId: string) => void;
}

const cardWidth = 240;
const cardHeight = 128;
const cardGap = 20;
const columnGap = 64;
const headerHeight = 16;

// Roland-Garros-styled status tone. Live = orange (clay); completed = dark forest green.
const liveScoreTone: Record<ProviderMatchStatus, string> = {
  scheduled: "bg-slate-100 text-slate-600",
  live: "bg-clay-100 text-clay-700",
  completed: "bg-[#1a4d3a] text-white",
  retired: "bg-amber-100 text-amber-800",
  walkover: "bg-amber-100 text-amber-800",
  cancelled: "bg-slate-200 text-slate-700",
  needs_review: "bg-amber-100 text-amber-800"
};

const liveScoreLabel: Record<ProviderMatchStatus, string> = {
  scheduled: "Upcoming",
  live: "Live",
  completed: "Completed",
  retired: "Retired",
  walkover: "Walkover",
  cancelled: "Cancelled",
  needs_review: "Review"
};

function formatLiveScore(score: BracketLiveScore) {
  const setScores = score.player1Linescores
    .map((line, index) => {
      const otherLine = score.player2Linescores[index];
      if (!line.displayValue || !otherLine?.displayValue) return null;
      const tiebreak = line.tiebreak !== null && line.tiebreak !== undefined && otherLine.tiebreak !== null && otherLine.tiebreak !== undefined
        ? ` (${line.tiebreak}-${otherLine.tiebreak})`
        : "";
      return `${line.displayValue}-${otherLine.displayValue}${tiebreak}`;
    })
    .filter(Boolean)
    .join(" ");

  return setScores || score.scoreSummary || null;
}

// Nearest ancestor that actually scrolls vertically. Returns null when the
// page itself is the scroller (so callers fall back to window). Lets the board
// work both in the normal page-scroll layout and the app-shell (where a fixed
// container scrolls instead of the document).
function getVerticalScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function BracketBoard({
  bracketId = "",
  matches,
  players,
  rounds,
  picks = [],
  mode,
  locked,
  title,
  highlightedMatchId,
  pickedCount,
  totalPicks,
  liveScores,
  onPick
}: BracketBoardProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const playerById = new Map(players.map((player) => [player.id, player]));
  // Players who lost a real, completed match — i.e. are out of the draw. A pick
  // of an eliminated player can never score, so we strike the name through and
  // mark the pick dead (0) even before that pick's own match is played.
  const eliminatedPlayerIds = new Set<string>();
  for (const realMatch of matches) {
    if (!realMatch.winnerPlayerId) continue;
    if (realMatch.player1Id && realMatch.player1Id !== realMatch.winnerPlayerId) eliminatedPlayerIds.add(realMatch.player1Id);
    if (realMatch.player2Id && realMatch.player2Id !== realMatch.winnerPlayerId) eliminatedPlayerIds.add(realMatch.player2Id);
  }
  const matchById = new Map(matches.map((matchItem) => [matchItem.id, matchItem]));
  const roundPointsByNumber = new Map(rounds.map((roundItem) => [roundItem.roundNumber, roundItem.pointsPerCorrectPick]));
  const hasResults = matches.some((matchItem) => Boolean(matchItem.winnerPlayerId));
  // Live total from the user's own picks (mirrors each card's points), so the
  // score updates the instant they pick — no server rescore needed.
  const currentScore = picks.reduce((sum, pick) => {
    if (pick.bracketId !== bracketId) return sum;
    const pickMatch = matchById.get(pick.matchId);
    if (!pickMatch?.winnerPlayerId || pick.pickedWinnerPlayerId !== pickMatch.winnerPlayerId) return sum;
    return sum + (roundPointsByNumber.get(pickMatch.roundNumber) ?? 0);
  }, 0);
  const showScore = mode !== "real" && hasResults;
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const finalRound = sortedRounds[sortedRounds.length - 1];
  const contentWidth = sortedRounds.length * cardWidth + Math.max(0, sortedRounds.length - 1) * columnGap + 32;
  const progressPercent = totalPicks ? Math.min(100, Math.round(((pickedCount ?? 0) / totalPicks) * 100)) : 0;
  const [focusedRoundNumber, setFocusedRoundNumber] = useState(sortedRounds[0]?.roundNumber ?? 1);

  const getRoundLabel = (roundNumber: number) => {
    const labels: Record<number, string> = {
      1: "1T",
      2: "2T",
      3: "3T",
      4: "1/8",
      5: "1/4",
      6: "1/2",
      7: "F"
    };
    return labels[roundNumber] ?? `R${roundNumber}`;
  };

  const focusRound = (roundNumber: number, behavior: ScrollBehavior = "smooth") => {
    setFocusedRoundNumber(roundNumber);
    // The bracket has its own horizontal scroll container now (.bracket-scroll),
    // so we scroll INSIDE that ref instead of moving the window.
    scrollRef.current?.scrollTo({
      left: getRoundScrollX(roundNumber),
      behavior
    });
  };

  // Native horizontal scroll DRIVES the focused round (no custom swipe gesture, which
  // used to fight native scroll and leave the bracket in a half-collapsed state).
  // As you scroll/swipe across, the round nearest the left edge becomes focused, so
  // the columns always collapse correctly to wherever you've scrolled.
  const focusSyncTimer = useRef<number | null>(null);
  const handleScroll = () => {
    if (focusSyncTimer.current) window.clearTimeout(focusSyncTimer.current);
    focusSyncTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const span = cardWidth + columnGap;
      const index = Math.round((el.scrollLeft + 12) / span);
      const target = sortedRounds[Math.min(Math.max(index, 0), sortedRounds.length - 1)];
      if (target && target.roundNumber !== focusedRoundNumber) {
        setFocusedRoundNumber(target.roundNumber);
      }
    }, 90);
  };

  const getRoundMatches = (roundNumber: number) =>
    matches
      .filter((match) => match.roundNumber === roundNumber)
      .sort((a, b) => a.matchNumber - b.matchNumber);

  const getX = (roundNumber: number) => {
    const span = cardWidth + columnGap;
    return (roundNumber - 1) * span;
  };

  // The scrollLeft a round lands at when focused. The mobile scroll-snap anchors
  // and focusRound() both use this so a swipe snaps to exactly where a chip tap
  // would scroll. Clamped so round 1 snaps flush to the left edge.
  const getRoundScrollX = (roundNumber: number) => Math.max(0, getX(roundNumber) - 12);

  const getY = (roundNumber: number, localIndex: number) => {
    const step = cardHeight + cardGap;
    const roundDistance = roundNumber - focusedRoundNumber;
    const stride = step * Math.pow(2, Math.max(0, roundDistance));
    return headerHeight + localIndex * stride + (stride - step) / 2;
  };

  const getRoundHeight = (roundNumber: number) => {
    const roundMatches = getRoundMatches(roundNumber);
    if (!roundMatches.length) return headerHeight + cardHeight;
    return getY(roundNumber, roundMatches.length - 1) + cardHeight + 48;
  };

  const boardHeight = Math.max(760, ...sortedRounds.map((round) => getRoundHeight(round.roundNumber)));
  const contentHeight = boardHeight + 24;

  // When the focused round changes (swipe or chip tap), drop the user at the
  // first pick they still need to make in that round — or its top match if the
  // round is complete. The focused round's cards pack to the top, but the board
  // stays as tall as the longest round, so without this a swipe from the bottom
  // of a long round (e.g. R1) lands in empty space below a shorter round's last
  // card. Vertical-only scroll so we never disturb the horizontal round snap.
  const didInitialFocus = useRef(false);
  useEffect(() => {
    if (!didInitialFocus.current) {
      didInitialFocus.current = true;
      return;
    }
    const roundMatches = getRoundMatches(focusedRoundNumber);
    if (!roundMatches.length || !boardRef.current) return;
    let targetIndex = roundMatches.findIndex(
      (match) => !picks.some((pick) => pick.bracketId === bracketId && pick.matchId === match.id)
    );
    if (targetIndex < 0) targetIndex = 0;
    // Compute the target's FINAL position from the layout model (getY) instead of
    // reading the DOM. The cards animate their `top` (duration-300), so a rect
    // read would be mid-flight. Computing it means we can scroll immediately —
    // which also stops the page from drifting down on swipe momentum during a
    // wait before we correct it.
    const cardY = getY(focusedRoundNumber, targetIndex);
    const headerOffset = headerRef.current?.offsetHeight ?? 0;
    const scroller = getVerticalScrollParent(boardRef.current);
    if (scroller) {
      const boardTopInScroller =
        boardRef.current.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.scrollTo({ top: Math.max(0, boardTopInScroller + cardY - headerOffset - 12), behavior: "smooth" });
    } else {
      const boardTopDoc = boardRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: Math.max(0, boardTopDoc + cardY - headerOffset - 12), behavior: "smooth" });
    }
    // Only react to round changes — not to each pick, which would yank the view
    // mid-pick. picks/bracketId are read at swipe time on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedRoundNumber]);

  const renderMatch = (match: Match, compact = false) => {
    const projected =
      mode === "real" ? { player1Id: match.player1Id, player2Id: match.player2Id } : getProjectedMatchPlayers(match, picks, matches, bracketId);
    const selected = picks.find((pick) => pick.bracketId === bracketId && pick.matchId === match.id);
    const pickedWinnerId = selected?.pickedWinnerPlayerId ?? null;
    const roundPoints = rounds.find((roundItem) => roundItem.roundNumber === match.roundNumber)?.pointsPerCorrectPick ?? 0;
    // Score the pick client-side against the real result so it reflects the
    // instant you pick — no waiting for a server rescore. Correct = the round's
    // points; a beaten pick OR one whose player is already out of the draw = 0.
    const pickOutcome: "none" | "pending" | "correct" | "wrong" = !pickedWinnerId
      ? "none"
      : match.winnerPlayerId
        ? pickedWinnerId === match.winnerPlayerId
          ? "correct"
          : "wrong"
        : eliminatedPlayerIds.has(pickedWinnerId)
          ? "wrong"
          : "pending";
    const playerIds = [projected.player1Id, projected.player2Id];
    const displaysRealMatch =
      mode === "real" ||
      (Boolean(projected.player1Id) &&
        Boolean(projected.player2Id) &&
        projected.player1Id === match.player1Id &&
        projected.player2Id === match.player2Id);
    const liveScore = displaysRealMatch ? liveScores?.[match.id] : undefined;
    const providerScore = liveScore ? formatLiveScore(liveScore) : null;

    // Status chip uses the live score if we have one, otherwise the stored match status.
    const matchStatusForChip: ProviderMatchStatus | null = liveScore
      ? liveScore.status
      : displaysRealMatch
        ? (match.status === "completed" ? "completed" : match.status === "live" ? "live" : "scheduled")
        : null;

    return (
      <article
        id={`match-${match.id}`}
        key={match.id}
        className={cn(
          "relative scroll-m-24 flex flex-col overflow-hidden rounded-lg border border-[#c8d3c9] bg-white shadow-sm transition",
          highlightedMatchId === match.id && "ring-4 ring-clay-300",
          compact ? "p-3" : "p-2.5"
        )}
        style={{ height: cardHeight }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          {matchStatusForChip ? (
            <span className={cn("rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide", liveScoreTone[matchStatusForChip])}>
              {liveScoreLabel[matchStatusForChip]}
            </span>
          ) : (
            <span className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wide bg-slate-100 text-slate-400">
              Upcoming
            </span>
          )}
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {match.roundNumber === finalRound?.roundNumber ? "Final" : `Match ${match.matchNumber}`}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          {playerIds.map((playerId, index) => {
            const player = playerId ? playerById.get(playerId) : null;
            const isPicked = selected?.pickedWinnerPlayerId === playerId;
            const hasResult = displaysRealMatch && Boolean(match.winnerPlayerId);
            const isWinner = hasResult && Boolean(playerId) && match.winnerPlayerId === playerId;
            // Out of the draw (lost a real match somewhere), regardless of whether
            // this card is showing the real matchup or your projected one.
            const isEliminated = Boolean(playerId) && eliminatedPlayerIds.has(playerId!);
            // Strike a name through only where it represents NOT advancing: on a
            // real matchup that's this match's loser; on your projected matchup
            // it's a player already out of the draw (so can't really be here). A
            // player who won this match isn't struck even if they lose later.
            const showAsOut = displaysRealMatch ? hasResult && Boolean(player) && !isWinner : isEliminated;
            const disabled = !player || locked || mode !== "picking";
            const flag = countryCodeToFlagEmoji(player?.country);
            // Your pick's pill color mirrors the pick outcome computed above.
            const pickState: "none" | "pending" | "correct" | "wrong" = isPicked ? pickOutcome : "none";
            return (
              <button
                key={`${match.id}-${index}`}
                disabled={disabled}
                onClick={() => playerId && onPick?.(match.id, playerId)}
                className={cn(
                  "flex w-full flex-1 items-center justify-between gap-2 rounded px-2 text-left text-[13px] leading-none transition",
                  pickState === "pending" && "bg-slate-100",
                  pickState === "correct" && "bg-court-100",
                  pickState === "wrong" && "bg-clay-100",
                  showAsOut && !isPicked && "opacity-60",
                  !disabled && pickState === "none" && "hover:bg-slate-50"
                )}
              >
                <span className="flex min-w-0 items-center gap-2 leading-none">
                  {flag ? (
                    <span className="shrink-0 text-base leading-none" aria-label={player?.country ?? undefined}>{flag}</span>
                  ) : player?.country ? (
                    <span className="shrink-0 rounded-sm bg-slate-100 px-1 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      {player.country}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "truncate text-sm",
                      isWinner ? "font-extrabold text-ink" : "font-bold text-ink",
                      showAsOut && "line-through",
                      showAsOut && !isPicked && "font-semibold text-slate-400",
                      showAsOut && isPicked && "text-clay-700"
                    )}
                  >
                    {player?.name ?? "TBD"}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {isPicked ? (
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-black uppercase tracking-wide",
                        pickState === "pending" && "bg-slate-200 text-slate-600",
                        pickState === "correct" && "bg-court-200 text-court-700",
                        pickState === "wrong" && "bg-clay-300 text-clay-700"
                      )}
                    >
                      Pick
                      {pickState === "correct" ? <Check size={10} /> : pickState === "wrong" ? <X size={10} /> : null}
                    </span>
                  ) : null}
                  {player?.seed ? (
                    <span className={cn("text-xs font-semibold", showAsOut && !isPicked ? "text-slate-400" : "text-slate-500")}>[{player.seed}]</span>
                  ) : null}
                  {isWinner ? (
                    <Trophy size={14} className="text-amber-500" />
                  ) : !isPicked && !disabled && !hasResult ? (
                    <CircleDot size={12} className="text-slate-300" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        {liveScore && providerScore ? (
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{providerScore}</p>
        ) : displaysRealMatch && match.scoreSummary ? (
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{match.scoreSummary}</p>
        ) : null}
        {pickOutcome === "correct" ? (
          <p className="mt-0.5 text-[10px] font-black text-court-700">+{roundPoints} pts</p>
        ) : pickOutcome === "wrong" ? (
          <p className="mt-0.5 text-[10px] font-black text-clay-700">0 pts</p>
        ) : null}
      </article>
    );
  };

  const renderConnectors = () => {
    const paths: React.ReactNode[] = [];

    for (const round of sortedRounds.slice(0, -1)) {
      const currentMatches = getRoundMatches(round.roundNumber);
      const nextMatches = getRoundMatches(round.roundNumber + 1);

      nextMatches.forEach((nextMatch, nextIndex) => {
        const firstSource = currentMatches[nextIndex * 2];
        const secondSource = currentMatches[nextIndex * 2 + 1];
        if (!firstSource || !secondSource || !nextMatch) return;

        const x1 = getX(round.roundNumber) + cardWidth;
        const x2 = getX(round.roundNumber + 1);
        const midX = x1 + columnGap / 2;
        const y1 = getY(round.roundNumber, nextIndex * 2) + cardHeight / 2;
        const y2 = getY(round.roundNumber, nextIndex * 2 + 1) + cardHeight / 2;
        const sourceMidY = (y1 + y2) / 2;
        const yTarget = getY(round.roundNumber + 1, nextIndex) + cardHeight / 2;

        paths.push(
          <path
            key={`${round.roundNumber}-${nextMatch.id}`}
            d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x1} M ${midX} ${sourceMidY} V ${yTarget} H ${x2}`}
            fill="none"
            stroke="#b8c0ba"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      });
    }

    return paths;
  };

  const renderBoard = () => (
    <div ref={boardRef} className="relative p-4" style={{ width: contentWidth, minHeight: contentHeight }}>
      <div
        className="absolute top-0 z-0 h-full bg-[#cdded0]"
        style={{
          left: getX(focusedRoundNumber) + 4,
          width: cardWidth + 24
        }}
      />
      <svg className="pointer-events-none absolute left-4 top-0 z-0" width={contentWidth} height={boardHeight} aria-hidden="true">
        {renderConnectors()}
      </svg>
      {/* Per-round scroll-snap anchors. Invisible 1px-wide strips at each round's
          focus scroll position; on mobile (.bracket-scroll has scroll-snap-type)
          a swipe snaps to one of these, one round per swipe. Inert on desktop. */}
      {sortedRounds.map((round) => (
        <div
          key={`snap-${round.id}`}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 z-0 snap-start snap-always"
          style={{ left: getRoundScrollX(round.roundNumber), width: 1, height: boardHeight }}
        />
      ))}
      {sortedRounds.flatMap((round) =>
        getRoundMatches(round.roundNumber).map((match, localIndex) => (
          <div
            key={match.id}
            className={cn(
              "absolute z-10 transition-[top] duration-300 ease-out",
              round.roundNumber === focusedRoundNumber && "z-20"
            )}
            style={{
              left: getX(round.roundNumber) + 16,
              top: getY(round.roundNumber, localIndex),
              width: cardWidth,
              height: cardHeight
            }}
          >
            {renderMatch(match)}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-[#bccfbe] bg-[#dde7dd] shadow-inner">
      <div ref={headerRef} className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          {title ? (
            <p className="min-w-0 truncate text-sm font-black text-ink">{title}</p>
          ) : (
            <p className="text-xs font-black uppercase text-court-700">Progress</p>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {showScore ? (
              <span className="rounded-full bg-court-100 px-2 py-0.5 text-xs font-black text-court-700">{currentScore} pts</span>
            ) : null}
            <p className="text-xs font-black text-ink">
              {pickedCount ?? 0} of {totalPicks ?? matches.length} picks
            </p>
          </div>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-court-50">
          <div className="h-full rounded-full bg-court-700" style={{ width: `${progressPercent}%` }} />
        </div>
        {/* Compact round selector — tap to jump/focus a round. */}
        <div className="mt-2 grid grid-cols-7 gap-1">
          {sortedRounds.map((round) => {
            const isActive = round.roundNumber === focusedRoundNumber;
            return (
              <button
                key={round.id}
                type="button"
                onClick={() => focusRound(round.roundNumber)}
                className={cn(
                  "min-w-0 rounded-md py-1.5 text-xs font-black transition",
                  isActive
                    ? "bg-[#1a4d3a] text-white shadow-sm"
                    : "bg-court-50 text-slate-500 hover:bg-court-100 hover:text-ink"
                )}
                aria-label={`Focus ${round.roundName}`}
              >
                {getRoundLabel(round.roundNumber)}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="bracket-scroll"
        onScroll={handleScroll}
      >
        {renderBoard()}
      </div>
    </div>
  );
}
