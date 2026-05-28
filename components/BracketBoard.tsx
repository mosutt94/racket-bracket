"use client";

import { useRef, useState } from "react";
import { Check, CircleDot, LocateFixed, Trophy } from "lucide-react";
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
  highlightedMatchId?: string | null;
  pickedCount?: number;
  totalPicks?: number;
  liveScores?: Record<string, BracketLiveScore>;
  nextMissingAvailable?: boolean;
  onNextMissing?: () => void;
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

export function BracketBoard({
  bracketId = "",
  matches,
  players,
  rounds,
  picks = [],
  mode,
  locked,
  highlightedMatchId,
  pickedCount,
  totalPicks,
  liveScores,
  nextMissingAvailable,
  onNextMissing,
  onPick
}: BracketBoardProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const playerById = new Map(players.map((player) => [player.id, player]));
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
      left: Math.max(0, getX(roundNumber) - 12),
      behavior
    });
  };

  // Swipe gestures on touch devices: swipe left → next round, swipe right → previous.
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Only treat as a horizontal swipe if it's clearly horizontal (avoid hijacking
    // vertical scrolls) and crosses a noticeable threshold.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const direction = dx < 0 ? 1 : -1; // swipe left → +1 (next round)
    const currentIndex = sortedRounds.findIndex((round) => round.roundNumber === focusedRoundNumber);
    const nextRound = sortedRounds[currentIndex + direction];
    if (nextRound) focusRound(nextRound.roundNumber);
  };

  const getRoundMatches = (roundNumber: number) =>
    matches
      .filter((match) => match.roundNumber === roundNumber)
      .sort((a, b) => a.matchNumber - b.matchNumber);

  const getX = (roundNumber: number) => {
    const span = cardWidth + columnGap;
    return (roundNumber - 1) * span;
  };

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

  const renderMatch = (match: Match, compact = false) => {
    const projected =
      mode === "real" ? { player1Id: match.player1Id, player2Id: match.player2Id } : getProjectedMatchPlayers(match, picks, matches, bracketId);
    const selected = picks.find((pick) => pick.bracketId === bracketId && pick.matchId === match.id);
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
            const isWinner = displaysRealMatch && Boolean(playerId) && match.winnerPlayerId === playerId;
            const disabled = !player || locked || mode !== "picking";
            const flag = countryCodeToFlagEmoji(player?.country);
            return (
              <button
                key={`${match.id}-${index}`}
                disabled={disabled}
                onClick={() => playerId && onPick?.(match.id, playerId)}
                className={cn(
                  "flex w-full flex-1 items-center justify-between gap-2 rounded px-2 text-left text-[13px] leading-none transition",
                  isPicked && !isWinner && "bg-court-50 text-court-900",
                  !isPicked && !isWinner && "bg-white text-ink",
                  isWinner && "bg-[#1a4d3a] text-white",
                  !disabled && !isWinner && "hover:bg-court-50"
                )}
              >
                <span className="flex min-w-0 items-center gap-2 leading-none">
                  {flag ? (
                    <span className="shrink-0 text-base leading-none" aria-label={player?.country ?? undefined}>{flag}</span>
                  ) : player?.country ? (
                    <span className={cn("shrink-0 rounded-sm px-1 py-0.5 text-[9px] font-black uppercase tracking-wider", isWinner ? "bg-white/20 text-white/90" : "bg-slate-100 text-slate-500")}>
                      {player.country}
                    </span>
                  ) : null}
                  <span className="truncate text-sm font-bold">{player?.name ?? "TBD"}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {player?.seed ? (
                    <span className={cn("text-xs font-semibold", isWinner ? "text-white/70" : "text-slate-500")}>[{player.seed}]</span>
                  ) : null}
                  {isWinner ? <Trophy size={14} /> : isPicked ? <Check size={14} /> : !disabled ? <CircleDot size={12} className="text-slate-300" /> : null}
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
        {selected?.isCorrect !== null && selected?.isCorrect !== undefined ? (
          <p className={cn("mt-0.5 text-[10px] font-black", selected.isCorrect ? "text-court-700" : "text-clay-700")}>
            {selected.isCorrect ? `+${selected.pointsAwarded}` : "0"} pts
          </p>
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
    <div className="relative p-4" style={{ width: contentWidth, minHeight: contentHeight }}>
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

  const renderRoundPreview = (roundNumber: number, isActive: boolean) => {
    const lineCount = Math.max(1, Math.min(8, Math.ceil(9 - roundNumber)));
    return (
      <span
        className={cn(
          "mt-2 flex h-14 w-full max-w-14 flex-col justify-center rounded-lg px-2 transition sm:max-w-20",
          isActive ? "bg-[#1a4d3a] shadow-sm" : "bg-transparent"
        )}
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }).map((_, index) => (
          <span
            key={index}
            className={cn("mb-1 block h-0.5 w-full rounded-full last:mb-0", isActive ? "bg-white/80" : "bg-[#c8d3c9]")}
          />
        ))}
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-[#bccfbe] bg-[#dde7dd] shadow-inner">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black uppercase text-court-700">Progress</p>
            <p className="text-sm font-black text-ink">
              {pickedCount ?? 0} of {totalPicks ?? matches.length} picks
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-court-50">
            <div className="h-full rounded-full bg-court-700" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {nextMissingAvailable ? (
              <button
                type="button"
                onClick={onNextMissing}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-xs font-bold text-white"
              >
                <LocateFixed size={14} /> Next missing
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 overflow-hidden">
          {sortedRounds.map((round) => {
            const isActive = round.roundNumber === focusedRoundNumber;
            return (
              <button
                key={round.id}
                type="button"
                onClick={() => focusRound(round.roundNumber)}
                className={cn(
                  "flex min-w-0 flex-col items-center overflow-hidden rounded-lg py-1 text-xs font-black transition",
                  isActive ? "text-[#111827]" : "text-[#a2a6aa] hover:bg-[#f3f6f4] hover:text-[#111827]"
                )}
                aria-label={`Focus ${round.roundName}`}
              >
                <span>{getRoundLabel(round.roundNumber)}</span>
                {renderRoundPreview(round.roundNumber, isActive)}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={scrollRef}
        className="bracket-scroll"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {renderBoard()}
      </div>
    </div>
  );
}
