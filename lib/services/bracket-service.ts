import type { BracketPick, Match } from "@/lib/types";
import { makeId } from "@/lib/utils";

export function pickWinner(args: {
  bracketId: string;
  matchId: string;
  playerId: string;
  matches: Match[];
  picks: BracketPick[];
}) {
  const match = args.matches.find((item) => item.id === args.matchId);
  if (!match) return args.picks;

  const withoutDownstream = removeInvalidDownstreamPicks(args.picks, args.matches, args.matchId);
  const existing = withoutDownstream.find((pick) => pick.bracketId === args.bracketId && pick.matchId === args.matchId);

  if (existing) {
    return withoutDownstream.map((pick) =>
      pick.id === existing.id
        ? { ...pick, pickedWinnerPlayerId: args.playerId, isCorrect: null, pointsAwarded: 0 }
        : pick
    );
  }

  return [
    ...withoutDownstream,
    {
      id: makeId("pick"),
      bracketId: args.bracketId,
      matchId: args.matchId,
      pickedWinnerPlayerId: args.playerId,
      isCorrect: null,
      pointsAwarded: 0
    }
  ];
}

export function getProjectedMatchPlayers(match: Match, picks: BracketPick[], matches: Match[], bracketId: string) {
  const priorMatches = matches.filter((candidate) => candidate.nextMatchId === match.id);
  const projected = { player1Id: match.player1Id ?? null, player2Id: match.player2Id ?? null };

  for (const priorMatch of priorMatches) {
    const pick = picks.find((item) => item.bracketId === bracketId && item.matchId === priorMatch.id);
    if (!pick || !priorMatch.nextMatchSlot) continue;
    projected[`${priorMatch.nextMatchSlot}Id`] = pick.pickedWinnerPlayerId;
  }

  return projected;
}

export function isBracketComplete(bracketId: string, matches: Match[], picks: BracketPick[]) {
  return matches.every((match) => picks.some((pick) => pick.bracketId === bracketId && pick.matchId === match.id));
}

function removeInvalidDownstreamPicks(picks: BracketPick[], matches: Match[], changedMatchId: string) {
  const ids = new Set<string>();
  let current = matches.find((match) => match.id === changedMatchId);

  while (current?.nextMatchId) {
    ids.add(current.nextMatchId);
    current = matches.find((match) => match.id === current?.nextMatchId);
  }

  return picks.filter((pick) => !ids.has(pick.matchId));
}
