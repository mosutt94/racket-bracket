import type { AppState, Bracket, BracketPick, ScoreEvent } from "@/lib/types";
import { makeId } from "@/lib/utils";

export function recalculateScores(state: AppState, tournamentId: string): AppState {
  const tournamentMatches = state.matches.filter((match) => match.tournamentId === tournamentId);
  const roundPoints = new Map(
    state.rounds
      .filter((round) => round.tournamentId === tournamentId)
      .map((round) => [round.roundNumber, round.pointsPerCorrectPick])
  );
  const matchById = new Map(tournamentMatches.map((match) => [match.id, match]));
  const affectedBracketIds = new Set(
    state.brackets.filter((bracket) => bracket.tournamentId === tournamentId).map((bracket) => bracket.id)
  );

  const recalculatedPicks: BracketPick[] = state.bracketPicks.map((pick) => {
    if (!affectedBracketIds.has(pick.bracketId)) return pick;
    const match = matchById.get(pick.matchId);
    if (!match?.winnerPlayerId || match.status !== "completed") {
      return { ...pick, isCorrect: null, pointsAwarded: 0 };
    }
    const isCorrect = pick.pickedWinnerPlayerId === match.winnerPlayerId;
    return {
      ...pick,
      isCorrect,
      pointsAwarded: isCorrect ? roundPoints.get(match.roundNumber) ?? 0 : 0
    };
  });

  const scoreByBracket = new Map<string, number>();
  for (const pick of recalculatedPicks) {
    if (!affectedBracketIds.has(pick.bracketId)) continue;
    scoreByBracket.set(pick.bracketId, (scoreByBracket.get(pick.bracketId) ?? 0) + pick.pointsAwarded);
  }

  const brackets: Bracket[] = state.brackets.map((bracket) =>
    bracket.tournamentId === tournamentId ? { ...bracket, totalScore: scoreByBracket.get(bracket.id) ?? 0 } : bracket
  );

  const events: ScoreEvent[] = recalculatedPicks
    .filter((pick) => affectedBracketIds.has(pick.bracketId) && pick.pointsAwarded > 0)
    .map((pick) => {
      const bracket = brackets.find((item) => item.id === pick.bracketId);
      return {
        id: makeId("score"),
        tournamentId,
        matchId: pick.matchId,
        userId: bracket?.userId ?? "unknown",
        bracketPickId: pick.id,
        pointsAwarded: pick.pointsAwarded,
        reason: "Correct winner pick",
        createdAt: new Date().toISOString()
      };
    });

  return {
    ...state,
    brackets,
    bracketPicks: recalculatedPicks,
    scoreEvents: [...state.scoreEvents.filter((event) => event.tournamentId !== tournamentId), ...events]
  };
}

export function getLeaderboard(state: AppState, poolId: string, tournamentId: string) {
  const members = state.poolMembers.filter((member) => member.poolId === poolId);
  return members
    .map((member) => {
      const profile = state.profiles.find((item) => item.id === member.userId);
      const bracket = state.brackets.find(
        (item) => item.poolId === poolId && item.tournamentId === tournamentId && item.userId === member.userId
      );
      return {
        userId: member.userId,
        displayName: profile?.displayName ?? "Unknown player",
        role: member.role,
        score: bracket?.totalScore ?? 0,
        bracketStatus: bracket?.status ?? "draft"
      };
    })
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
}
