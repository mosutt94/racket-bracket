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

type TennisApiTour = "atp" | "wta";

interface TennisApiTournament {
  id: number;
  name: string;
  date?: string | null;
  rank?: { name?: string | null } | null;
  rankId?: number | null;
  draw_size?: number | null;
}

interface TennisApiPlayer {
  id: number;
  name: string;
  countryAcr?: string | null;
}

interface TennisApiMatch {
  id: number;
  date?: string | null;
  result?: string | null;
  live?: string | null;
  complete?: number | null;
  roundId?: number | null;
  round?: { name?: string | null } | null;
  player1?: TennisApiPlayer | null;
  player2?: TennisApiPlayer | null;
}

const host = "tennis-api-atp-wta-itf.p.rapidapi.com";
const baseUrl = `https://${host}`;

const slamNames: Record<SlamType, string[]> = {
  australian_open: ["australian open"],
  french_open: ["roland garros", "french open"],
  wimbledon: ["wimbledon"],
  us_open: ["us open", "u.s. open", "usopen"]
};

export class TennisApiProvider {
  private readonly apiKey = process.env.TENNIS_API_RAPIDAPI_KEY;

  async listUpcomingGrandSlams(): Promise<UpcomingGrandSlam[]> {
    this.ensureConfigured();
    const year = new Date().getFullYear();
    const events = await Promise.all([
      this.getGrandSlamCalendar("atp", year),
      this.getGrandSlamCalendar("wta", year)
    ]);

    return events.flat().map(({ tour, tournament, slamType }) => ({
      slamType,
      year,
      gender: tour === "atp" ? "men" : "women",
      name: `${this.displaySlamName(slamType)} ${year} ${tour === "atp" ? "Men's" : "Women's"} Singles`,
      qualifyingStartsAt: tournament.date ?? `${year}-01-01T00:00:00.000Z`,
      mainDrawStartsAt: tournament.date ?? `${year}-01-01T00:00:00.000Z`,
      finalStartsAt: this.estimateFinalDate(tournament.date),
      status: "draw_partial",
      externalProviderId: this.makeSeasonId(tour, tournament.id)
    }));
  }

  async getTournamentInstance(slamType: SlamType, year: number, gender: Gender): Promise<TournamentInstance> {
    this.ensureConfigured();
    const tour = this.getTour(gender);
    const calendar = await this.getGrandSlamCalendar(tour, year);
    const found = calendar.find((item) => item.slamType === slamType);
    if (!found) throw new Error(`Tennis API did not return ${slamType} ${year} ${gender}.`);

    return {
      id: this.makeSeasonId(tour, found.tournament.id),
      name: `${this.displaySlamName(slamType)} ${year} ${gender === "men" ? "Men's" : "Women's"} Singles`,
      slamType,
      year,
      gender,
      status: "draw_partial",
      bracketSize: found.tournament.draw_size ?? 128,
      qualifyingStartsAt: found.tournament.date ?? `${year}-01-01T00:00:00.000Z`,
      mainDrawStartsAt: found.tournament.date ?? `${year}-01-01T00:00:00.000Z`,
      finalStartsAt: this.estimateFinalDate(found.tournament.date),
      providerName: "TennisApiProvider",
      externalProviderId: this.makeSeasonId(tour, found.tournament.id),
      lastSyncedAt: null,
      createdAt: new Date().toISOString()
    };
  }

  async getTournamentDraw(_tournamentConfig: Tournament): Promise<DrawData> {
    throw new Error("TennisApiProvider draw import is not enabled yet. Use provider preview before replacing the seeded draw.");
  }

  async getDraw(_instanceId: string): Promise<DrawData> {
    throw new Error("TennisApiProvider draw import is not enabled yet. Use provider preview before replacing the seeded draw.");
  }

  async getLiveMatches(instanceId: string): Promise<LiveMatchData[]> {
    const { tour, seasonId } = this.parseSeasonId(instanceId);
    const fixtures = await this.fetchFixtureRows(tour, seasonId);
    return fixtures
      .filter((match) => match.live)
      .map((match) => ({
        externalProviderMatchId: this.makeMatchId(match.id),
        status: "live",
        scoreSummary: match.live ?? null
      }));
  }

  async getCompletedMatches(instanceId: string): Promise<CompletedMatchData[]> {
    const { tour, seasonId } = this.parseSeasonId(instanceId);
    const results = await this.fetchResultRows(tour, seasonId);
    return results
      .filter((match) => match.player1?.id && match.result)
      .map((match) => ({
        externalProviderMatchId: this.makeMatchId(match.id),
        winnerExternalProviderId: this.makePlayerId(match.player1!.id),
        status: "completed",
        scoreSummary: match.result ?? null
      }));
  }

  async getMatchUpdates(instanceId: string): Promise<Array<LiveMatchData | CompletedMatchData>> {
    const [liveMatches, completedMatches] = await Promise.all([
      this.getLiveMatches(instanceId),
      this.getCompletedMatches(instanceId)
    ]);
    return [...liveMatches, ...completedMatches];
  }

  async getProviderHealth(): Promise<ProviderHealth> {
    if (!this.apiKey) {
      return {
        providerName: "TennisApiProvider",
        ok: false,
        mode: "free_api",
        message: "Missing TENNIS_API_RAPIDAPI_KEY. Add it to .env.local to test real Roland Garros data.",
        checkedAt: new Date().toISOString()
      };
    }

    try {
      const calendar = await this.getGrandSlamCalendar("atp", new Date().getFullYear());
      const rolandGarros = calendar.find((item) => item.slamType === "french_open");
      return {
        providerName: "TennisApiProvider",
        ok: Boolean(rolandGarros),
        mode: "free_api",
        message: rolandGarros
          ? `Connected. Found ${rolandGarros.tournament.name} season ${rolandGarros.tournament.id}.`
          : "Connected, but Roland Garros was not found in the ATP Grand Slam calendar.",
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        providerName: "TennisApiProvider",
        ok: false,
        mode: "free_api",
        message: error instanceof Error ? error.message : "Could not reach Tennis API.",
        checkedAt: new Date().toISOString()
      };
    }
  }

  async previewGrandSlam(slamType: SlamType, year: number, gender: Gender) {
    this.ensureConfigured();
    const tour = this.getTour(gender);
    const calendar = await this.getGrandSlamCalendar(tour, year);
    const found = calendar.find((item) => item.slamType === slamType);
    if (!found) throw new Error(`Could not find ${slamType} ${year} ${gender} in Tennis API calendar.`);

    const [fixtures, results] = await Promise.all([
      this.fetchFixtureRows(tour, found.tournament.id),
      this.fetchResultRows(tour, found.tournament.id)
    ]);

    return {
      providerName: "TennisApiProvider",
      tournament: found.tournament,
      externalProviderId: this.makeSeasonId(tour, found.tournament.id),
      fixturesCount: fixtures.length,
      completedResultsCount: results.length,
      sampleFixtures: fixtures.slice(0, 5).map((match) => this.summarizeMatch(match)),
      sampleResults: results.slice(0, 5).map((match) => this.summarizeMatch(match))
    };
  }

  private async getGrandSlamCalendar(tour: TennisApiTour, year: number) {
    const rows = await this.request<TennisApiTournament[] | { data?: TennisApiTournament[] }>(
      `/tennis/v2/${tour}/tournament/calendar/${year}?include=rating&filter=TourRank:1&pageSize=100`
    );
    const tournaments = Array.isArray(rows) ? rows : rows.data ?? [];
    return tournaments
      .map((tournament) => ({ tournament, slamType: this.getSlamType(tournament.name), tour }))
      .filter((item): item is { tournament: TennisApiTournament; slamType: SlamType; tour: TennisApiTour } => Boolean(item.slamType));
  }

  private async fetchFixtureRows(tour: TennisApiTour, seasonId: number) {
    const rows = await this.request<TennisApiMatch[] | { data?: TennisApiMatch[] }>(
      `/tennis/v2/${tour}/fixtures/tournament/${seasonId}?include=round,tournament&pageSize=200`
    );
    return Array.isArray(rows) ? rows : rows.data ?? [];
  }

  private async fetchResultRows(tour: TennisApiTour, seasonId: number) {
    const rows = await this.request<TennisApiMatch[] | { data?: { singles?: TennisApiMatch[] } }>(
      `/tennis/v2/${tour}/tournament/results/${seasonId}`
    );
    if (Array.isArray(rows)) return rows;
    return rows.data?.singles ?? [];
  }

  private async request<T>(path: string): Promise<T> {
    this.ensureConfigured();
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        "X-RapidAPI-Key": this.apiKey!,
        "X-RapidAPI-Host": host
      },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Tennis API ${response.status}: ${await response.text()}`);
    }
    return response.json() as Promise<T>;
  }

  private ensureConfigured() {
    if (!this.apiKey) throw new Error("Missing TENNIS_API_RAPIDAPI_KEY.");
  }

  private getTour(gender: Gender): TennisApiTour {
    return gender === "men" ? "atp" : "wta";
  }

  private getSlamType(name: string): SlamType | null {
    const normalized = name.toLowerCase();
    const entry = Object.entries(slamNames).find(([, aliases]) => aliases.some((alias) => normalized.includes(alias)));
    return (entry?.[0] as SlamType | undefined) ?? null;
  }

  private displaySlamName(slamType: SlamType) {
    if (slamType === "australian_open") return "Australian Open";
    if (slamType === "french_open") return "French Open";
    if (slamType === "wimbledon") return "Wimbledon";
    return "US Open";
  }

  private estimateFinalDate(startDate?: string | null) {
    if (!startDate) return new Date().toISOString();
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + 14);
    return date.toISOString();
  }

  private makeSeasonId(tour: TennisApiTour, seasonId: number) {
    return `tennis-api:${tour}:${seasonId}`;
  }

  private makeMatchId(matchId: number) {
    return `tennis-api-match-${matchId}`;
  }

  private makePlayerId(playerId: number) {
    return `tennis-api-player-${playerId}`;
  }

  private parseSeasonId(instanceId: string): { tour: TennisApiTour; seasonId: number } {
    const [, tour, rawSeasonId] = instanceId.split(":");
    const seasonId = Number(rawSeasonId);
    if ((tour !== "atp" && tour !== "wta") || !Number.isFinite(seasonId)) {
      throw new Error(`TennisApiProvider expected instance id like tennis-api:atp:8871, got ${instanceId}.`);
    }
    return { tour, seasonId };
  }

  private summarizeMatch(match: TennisApiMatch) {
    return {
      externalProviderMatchId: this.makeMatchId(match.id),
      round: match.round?.name ?? match.roundId ?? null,
      player1: match.player1?.name ?? "TBD",
      player2: match.player2?.name ?? "TBD",
      score: match.result || match.live || null,
      status: match.result ? "completed" : match.live ? "live" : "scheduled"
    };
  }
}
