import { initialState } from "@/lib/seed";
import type {
  CompletedMatchData,
  DrawData,
  Gender,
  LiveMatchData,
  ProviderHealth,
  SlamType,
  Tournament,
  TournamentInstance,
  UpcomingGrandSlam
} from "@/lib/types";
import type { TennisDataProvider } from "./tennis-data-provider";

export class MockTennisDataProvider implements TennisDataProvider {
  async listUpcomingGrandSlams(): Promise<UpcomingGrandSlam[]> {
    return [
      {
        slamType: "french_open",
        year: 2026,
        gender: "men",
        name: "French Open 2026 Men's Singles",
        qualifyingStartsAt: "2026-05-18T14:00:00.000Z",
        mainDrawStartsAt: "2026-05-24T14:00:00.000Z",
        finalStartsAt: "2026-06-07T13:00:00.000Z",
        status: "draw_partial",
        externalProviderId: "mock-roland-garros-2026-men"
      },
      {
        slamType: "french_open",
        year: 2026,
        gender: "women",
        name: "French Open 2026 Women's Singles",
        qualifyingStartsAt: "2026-05-18T14:00:00.000Z",
        mainDrawStartsAt: "2026-05-24T14:00:00.000Z",
        finalStartsAt: "2026-06-06T13:00:00.000Z",
        status: "draw_pending",
        externalProviderId: "mock-roland-garros-2026-women"
      },
      {
        slamType: "wimbledon",
        year: 2026,
        gender: "men",
        name: "Wimbledon 2026 Men's Singles",
        qualifyingStartsAt: "2026-06-22T11:00:00.000Z",
        mainDrawStartsAt: "2026-06-29T11:00:00.000Z",
        finalStartsAt: "2026-07-12T13:00:00.000Z",
        status: "scheduled",
        externalProviderId: "mock-wimbledon-2026-men"
      }
    ];
  }

  async getTournamentInstance(slamType: SlamType, year: number, gender: Gender): Promise<TournamentInstance> {
    const upcoming = (await this.listUpcomingGrandSlams()).find(
      (event) => event.slamType === slamType && event.year === year && event.gender === gender
    );
    if (!upcoming) throw new Error(`Mock provider has no tournament instance for ${slamType} ${year} ${gender}`);

    return {
      id: `instance_${slamType}_${year}_${gender}`,
      name: upcoming.name,
      slamType,
      year,
      gender,
      status: upcoming.status,
      bracketSize: 128,
      qualifyingStartsAt: upcoming.qualifyingStartsAt,
      mainDrawStartsAt: upcoming.mainDrawStartsAt,
      finalStartsAt: upcoming.finalStartsAt,
      providerName: "MockTennisDataProvider",
      externalProviderId: upcoming.externalProviderId,
      lastSyncedAt: null,
      createdAt: new Date().toISOString()
    };
  }

  async getTournamentDraw(tournamentConfig: Tournament): Promise<DrawData> {
    return {
      tournament: tournamentConfig,
      tournamentInstance: initialState.tournamentInstances.find((instance) => instance.id === tournamentConfig.tournamentInstanceId),
      rounds: initialState.rounds.filter((round) => round.tournamentId === tournamentConfig.id),
      players: initialState.players,
      matches: initialState.matches.filter((match) => match.tournamentId === tournamentConfig.id),
      drawSlots: initialState.drawSlots
    };
  }

  async getDraw(instanceId: string): Promise<DrawData> {
    const tournamentInstance = initialState.tournamentInstances.find((instance) => instance.id === "instance_french_2026_men");
    if (!tournamentInstance) throw new Error("Mock tournament instance missing.");
    return {
      tournamentInstance: { ...tournamentInstance, id: instanceId },
      rounds: initialState.rounds,
      players: initialState.players,
      matches: initialState.matches.map((match) => ({ ...match, tournamentInstanceId: instanceId })),
      drawSlots: initialState.drawSlots.map((slot) => ({ ...slot, tournamentInstanceId: instanceId }))
    };
  }

  async getLiveMatches(tournamentId: string): Promise<LiveMatchData[]> {
    const matches: LiveMatchData[] = [
      { externalProviderMatchId: "mock-match_r128_4", status: "live", scoreSummary: "6-4, 3-4" },
      { externalProviderMatchId: "mock-match_r128_37", status: "live", scoreSummary: "7-6, 2-1" }
    ];
    return matches;
  }

  async getCompletedMatches(tournamentId: string): Promise<CompletedMatchData[]> {
    return [
      {
        externalProviderMatchId: "mock-match_r128_1",
        winnerExternalProviderId: "mock-player_1",
        status: "completed",
        scoreSummary: "6-2, 6-4"
      },
      {
        externalProviderMatchId: "mock-match_r128_2",
        winnerExternalProviderId: "mock-player_4",
        status: "completed",
        scoreSummary: "4-6, 6-3, 7-5"
      },
      {
        externalProviderMatchId: "mock-match_r128_5",
        winnerExternalProviderId: "mock-player_9",
        status: "completed",
        scoreSummary: "6-1, 6-4"
      }
    ];
  }

  async getMatchUpdates(instanceId: string): Promise<Array<LiveMatchData | CompletedMatchData>> {
    return [...(await this.getLiveMatches(instanceId)), ...(await this.getCompletedMatches(instanceId))];
  }

  async getProviderHealth(): Promise<ProviderHealth> {
    return {
      providerName: "MockTennisDataProvider",
      ok: true,
      mode: "mock",
      message: "Mock provider simulates upcoming Slams, partial draws, qualifier resolution, and match updates.",
      checkedAt: new Date().toISOString()
    };
  }
}
