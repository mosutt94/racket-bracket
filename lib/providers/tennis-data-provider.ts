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

export interface TennisDataProvider {
  listUpcomingGrandSlams(): Promise<UpcomingGrandSlam[]>;
  getTournamentInstance(slamType: SlamType, year: number, gender: Gender): Promise<TournamentInstance>;
  getTournamentDraw(tournamentConfig: Tournament): Promise<DrawData>;
  getDraw(instanceId: string): Promise<DrawData>;
  getLiveMatches(tournamentId: string): Promise<LiveMatchData[]>;
  getCompletedMatches(tournamentId: string): Promise<CompletedMatchData[]>;
  getMatchUpdates(instanceId: string): Promise<Array<LiveMatchData | CompletedMatchData>>;
  getProviderHealth(): Promise<ProviderHealth>;
}
