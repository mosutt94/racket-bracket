import { getTennisDataProvider } from "@/lib/providers/provider-service";
import { recalculateScores } from "@/lib/services/scoring-service";
import type { AppState, CompletedMatchData } from "@/lib/types";
import { makeId } from "@/lib/utils";

export async function syncMockLiveScores(state: AppState, tournamentId: string): Promise<AppState> {
  const provider = getTennisDataProvider("mock");
  const [liveMatches, completedMatches] = await Promise.all([
    provider.getLiveMatches(tournamentId),
    provider.getCompletedMatches(tournamentId)
  ]);

  const playersByExternalId = new Map(state.players.map((player) => [player.externalProviderId, player.id]));
  const updates = [...liveMatches, ...completedMatches];

  const matches = state.matches.map((match) => {
    const update = updates.find((item) => item.externalProviderMatchId === match.externalProviderMatchId);
    if (!update) return match;
    const completedWinner =
      isCompletedMatchData(update) ? playersByExternalId.get(update.winnerExternalProviderId) ?? null : null;

    return {
      ...match,
      status: update.status,
      scoreSummary: update.scoreSummary ?? match.scoreSummary,
      winnerPlayerId: completedWinner ?? match.winnerPlayerId,
      updatedAt: new Date().toISOString()
    };
  });

  const withSnapshot: AppState = {
    ...state,
    matches,
    tournaments: state.tournaments.map((tournament) =>
      tournament.id === tournamentId ? { ...tournament, lastSyncedAt: new Date().toISOString() } : tournament
    ),
    liveScoreSnapshots: [
      ...state.liveScoreSnapshots,
      {
        id: makeId("snapshot"),
        tournamentId,
        providerName: "MockTennisDataProvider",
        rawPayload: { liveMatches, completedMatches },
        createdAt: new Date().toISOString()
      }
    ]
  };

  return recalculateScores(withSnapshot, tournamentId);
}

function isCompletedMatchData(value: unknown): value is CompletedMatchData {
  return typeof value === "object" && value !== null && "winnerExternalProviderId" in value;
}
