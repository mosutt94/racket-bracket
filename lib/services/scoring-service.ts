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
  const tournamentMatches = state.matches.filter((match) => match.tournamentId === tournamentId);
  const matchById = new Map(tournamentMatches.map((match) => [match.id, match]));
  const roundPoints = new Map(
    state.rounds
      .filter((round) => round.tournamentId === tournamentId)
      .map((round) => [round.roundNumber, round.pointsPerCorrectPick])
  );
  // Players out of the draw (lost a completed match) — their picks can't score.
  const eliminated = new Set<string>();
  for (const match of tournamentMatches) {
    if (!match.winnerPlayerId) continue;
    if (match.player1Id && match.player1Id !== match.winnerPlayerId) eliminated.add(match.player1Id);
    if (match.player2Id && match.player2Id !== match.winnerPlayerId) eliminated.add(match.player2Id);
  }
  const picksByBracket = new Map<string, BracketPick[]>();
  for (const pick of state.bracketPicks) {
    const arr = picksByBracket.get(pick.bracketId);
    if (arr) arr.push(pick);
    else picksByBracket.set(pick.bracketId, [pick]);
  }

  return members
    .map((member) => {
      const profile = state.profiles.find((item) => item.id === member.userId);
      const bracket = state.brackets.find(
        (item) => item.poolId === poolId && item.tournamentId === tournamentId && item.userId === member.userId
      );
      // current = points locked in; potential = current + every pick still alive
      // (player not eliminated, match undecided). Mirrors the bracket page.
      let score = 0;
      let potentialScore = 0;
      // Count of picks that have come true so far — independent of point value,
      // so a volume leader can differ from the points leader.
      let correctPicks = 0;
      for (const pick of bracket ? picksByBracket.get(bracket.id) ?? [] : []) {
        if (!pick.pickedWinnerPlayerId) continue;
        const match = matchById.get(pick.matchId);
        if (!match) continue;
        const pts = roundPoints.get(match.roundNumber) ?? 0;
        if (match.winnerPlayerId) {
          if (pick.pickedWinnerPlayerId === match.winnerPlayerId) {
            score += pts;
            potentialScore += pts;
            correctPicks += 1;
          }
        } else if (!eliminated.has(pick.pickedWinnerPlayerId)) {
          potentialScore += pts;
        }
      }
      return {
        userId: member.userId,
        displayName: profile?.displayName ?? "Unknown player",
        role: member.role,
        score,
        potentialScore,
        correctPicks,
        bracketStatus: bracket?.status ?? "draft"
      };
    })
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName));
}
