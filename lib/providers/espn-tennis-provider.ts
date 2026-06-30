import type {
  CompletedMatchData,
  DrawData,
  Gender,
  LiveMatchData,
  ProviderHealth,
  ProviderLineScore,
  ProviderMatch,
  ProviderMatchStatus,
  SlamType,
  Tournament,
  TournamentInstance,
  UpcomingGrandSlam
} from "@/lib/types";

type EspnTour = "atp" | "wta";

interface EspnGrandSlamConfig {
  slamType: SlamType;
  displayName: string;
  espnSlug: string;
  espnTournamentId: string;
  aliases: string[];
  dateRange: (year: number) => string;
  expectedFirstRoundSinglesMatches: number;
  expectedTotalSinglesMatches: number;
  menCompetitionType: "1";
  womenCompetitionType: "2";
  verified: boolean;
  notes: string;
}

const espnGrandSlamConfigs: Record<SlamType, EspnGrandSlamConfig> = {
  australian_open: {
    slamType: "australian_open",
    displayName: "Australian Open",
    espnSlug: "australian-open",
    espnTournamentId: "154",
    aliases: ["australian open"],
    dateRange: (year) => `${year}0112-${year}0126`,
    expectedFirstRoundSinglesMatches: 64,
    expectedTotalSinglesMatches: 127,
    menCompetitionType: "1",
    womenCompetitionType: "2",
    verified: false,
    notes: "Configured for ESPN bracket URLs; verify with live tournament payload before scoring."
  },
  french_open: {
    slamType: "french_open",
    displayName: "Roland Garros",
    espnSlug: "french-open",
    espnTournamentId: "172",
    aliases: ["roland garros", "french open"],
    dateRange: (year) => `${year}0518-${year}0608`,
    expectedFirstRoundSinglesMatches: 64,
    expectedTotalSinglesMatches: 127,
    menCompetitionType: "1",
    womenCompetitionType: "2",
    verified: true,
    notes: "Verified against 2026 Roland Garros ESPN scoreboard and embedded bracketLocation payload."
  },
  wimbledon: {
    slamType: "wimbledon",
    displayName: "Wimbledon",
    espnSlug: "wimbledon",
    espnTournamentId: "159",
    aliases: ["wimbledon"],
    dateRange: (year) => `${year}0629-${year}0712`,
    expectedFirstRoundSinglesMatches: 64,
    expectedTotalSinglesMatches: 127,
    menCompetitionType: "1",
    womenCompetitionType: "2",
    verified: false,
    notes: "Configured for ESPN bracket URLs; verify with live tournament payload before scoring."
  },
  us_open: {
    slamType: "us_open",
    displayName: "US Open",
    espnSlug: "us-open",
    espnTournamentId: "560",
    aliases: ["us open", "u.s. open"],
    dateRange: (year) => `${year}0824-${year}0907`,
    expectedFirstRoundSinglesMatches: 64,
    expectedTotalSinglesMatches: 127,
    menCompetitionType: "1",
    womenCompetitionType: "2",
    verified: false,
    notes: "Configured for ESPN bracket URLs; verify with live tournament payload before scoring."
  }
};

interface EspnScoreboard {
  day?: { date?: string };
  events?: EspnEvent[];
}

interface EspnEvent {
  id: string;
  name?: string;
  shortName?: string;
  groupings?: Array<{
    grouping?: {
      id?: string;
      slug?: string;
      displayName?: string;
    };
    competitions?: EspnCompetition[];
  }>;
  competitions?: EspnCompetition[];
}

interface EspnCompetition {
  id: string;
  uid?: string;
  date?: string;
  startDate?: string;
  status?: {
    type?: {
      name?: string;
      state?: string;
      completed?: boolean;
      description?: string;
      detail?: string;
      shortDetail?: string;
    };
  };
  competitors?: EspnCompetitor[];
  notes?: Array<{ text?: string }>;
  tournamentId?: number | string;
  type?: {
    text?: string;
    slug?: string;
  };
  round?: {
    displayName?: string;
  };
}

interface EspnCompetitor {
  id?: string;
  order?: number;
  winner?: boolean;
  linescores?: Array<{ value?: number; displayValue?: string; tiebreak?: number; winner?: boolean }>;
  athlete?: {
    displayName?: string;
    fullName?: string;
    shortName?: string;
  };
}

interface EspnBracketCompetitor {
  id: string;
  name: string;
  seed?: string;
  logo?: string;
  winner?: boolean;
  scores?: Array<{ v?: string; p?: number; w?: boolean }>;
}

interface EspnBracketMatchup {
  id: string;
  matchupId?: string;
  competitorOne: EspnBracketCompetitor;
  competitorTwo: EspnBracketCompetitor;
  bracketLocation: number;
  roundId: number;
  date?: string;
  // ESPN's bracket payload carries the authoritative per-match result even after
  // the live scoreboard drops finished matches at the end of a day's play.
  // statusState: "pre" | "in" | "post"; statusDesc: e.g. "Final", "Scheduled".
  statusState?: string;
  statusDesc?: string;
}

interface EspnBracketPayload {
  id: string;
  name: string;
  matchups: EspnBracketMatchup[];
}

interface ScoreboardResult {
  tour: EspnTour;
  ok: boolean;
  message: string;
  scoreboard?: EspnScoreboard;
  matches: ProviderMatch[];
}

export interface EspnPreview {
  providerName: "EspnTennisProvider";
  checkedAt: string;
  experimental: true;
  dateRange: string;
  config: {
    slamType: SlamType;
    displayName: string;
    espnSlug: string;
    espnTournamentId: string;
    expectedFirstRoundSinglesMatches: number;
    expectedTotalSinglesMatches: number;
    verified: boolean;
    notes: string;
  };
  sources: Array<{
    tour: EspnTour;
    ok: boolean;
    message: string;
    matchesCount: number;
    scheduledCount: number;
    liveCount: number;
    completedCount: number;
    reviewCount: number;
  }>;
  totalMatchesCount: number;
  scheduledCount: number;
  liveCount: number;
  completedCount: number;
  reviewCount: number;
  sampleScheduled: EspnPreviewMatch[];
  sampleLive: EspnPreviewMatch[];
  sampleFinal: EspnPreviewMatch[];
  rawPayload: unknown;
}

export interface EspnPreviewMatch {
  providerMatchId: string;
  tournamentName?: string | null;
  roundName?: string | null;
  eventType: ProviderMatch["eventType"];
  status: ProviderMatchStatus;
  player1: string;
  player2: string;
  score: string | null;
  winner: string | null;
  startTime?: string | null;
}

export interface EspnDrawSlot {
  position: number;
  matchNumber: number;
  providerMatchId: string;
  playerName: string;
  playerProviderId: string;
  seed?: number | null;
  country?: string | null;
}

export interface EspnDrawImportData {
  providerName: "EspnTennisProvider";
  tournamentName: string;
  tournamentId: string;
  eventType: ProviderMatch["eventType"];
  year: number;
  matchups: Array<{
    matchNumber: number;
    providerMatchId: string;
    startTime?: string | null;
    scoreSummary?: string | null;
    player1: EspnDrawSlot;
    player2: EspnDrawSlot;
  }>;
  rawPayload: unknown;
}

export interface EspnDrawMatchLink {
  roundNumber: number;
  matchNumber: number;
  providerMatchId: string;
  startTime?: string | null;
  // Authoritative result carried by the bracket payload. Used as a fallback to
  // finalize matches ESPN has dropped from the live scoreboard (e.g. once a
  // day's play ends). statusState === "post" means the match is final.
  statusState?: string | null;
  winnerProviderId?: string | null;
  scoreSummary?: string | null;
}

const baseUrl = "https://site.api.espn.com/apis/site/v2/sports/tennis";

export class EspnTennisProvider {
  async listUpcomingGrandSlams(): Promise<UpcomingGrandSlam[]> {
    return [];
  }

  async getTournamentInstance(_slamType: SlamType, _year: number, _gender: Gender): Promise<TournamentInstance> {
    throw new Error("EspnTennisProvider does not create tournament instances yet. Use preview before importing ESPN data.");
  }

  async getTournamentDraw(_tournamentConfig: Tournament): Promise<DrawData> {
    throw new Error("EspnTennisProvider draw import is not enabled yet. Use preview before replacing seeded data.");
  }

  async getDraw(_instanceId: string): Promise<DrawData> {
    throw new Error("EspnTennisProvider draw import is not enabled yet. Use preview before replacing seeded data.");
  }

  async getScheduledMatches(): Promise<ProviderMatch[]> {
    const preview = await this.previewGrandSlam();
    return this.getAllPreviewMatches(preview).filter((match) => match.status === "scheduled");
  }

  async getLiveMatches(_tournamentId?: string): Promise<LiveMatchData[]> {
    const preview = await this.previewGrandSlam();
    return this.getAllPreviewMatches(preview)
      .filter((match) => match.status === "live")
      .map((match) => ({
        externalProviderMatchId: this.makeProviderMatchId(match.providerMatchId),
        status: "live",
        scoreSummary: match.scoreSummary ?? null
      }));
  }

  async getCompletedMatches(_tournamentId?: string): Promise<CompletedMatchData[]> {
    const preview = await this.previewGrandSlam();
    return this.getAllPreviewMatches(preview)
      .filter((match) => match.status === "completed" && match.winnerProviderId)
      .map((match) => ({
        externalProviderMatchId: this.makeProviderMatchId(match.providerMatchId),
        winnerExternalProviderId: this.makeProviderPlayerId(match.winnerProviderId!),
        status: "completed",
        scoreSummary: match.scoreSummary ?? null
      }));
  }

  async getMatchUpdates(instanceId: string): Promise<Array<LiveMatchData | CompletedMatchData>> {
    const [liveMatches, completedMatches] = await Promise.all([
      this.getLiveMatches(instanceId),
      this.getCompletedMatches(instanceId)
    ]);
    return [...liveMatches, ...completedMatches];
  }

  async getMatchSummary(eventId: string) {
    return this.request<unknown>(`/atp/summary?event=${encodeURIComponent(eventId)}`);
  }

  async getProviderHealth(): Promise<ProviderHealth> {
    try {
      const scoreboard = await this.fetchScoreboard("atp");
      const hasEvents = Boolean(scoreboard.events?.length);
      return {
        providerName: "EspnTennisProvider",
        ok: hasEvents,
        mode: "free_api",
        message: hasEvents
          ? "Connected to ESPN tennis scoreboard. Treat this feed as experimental and unofficial."
          : "Connected to ESPN, but no tennis events were returned.",
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      return {
        providerName: "EspnTennisProvider",
        ok: false,
        mode: "free_api",
        message: error instanceof Error ? error.message : "Could not reach ESPN tennis scoreboard.",
        checkedAt: new Date().toISOString()
      };
    }
  }

  async previewGrandSlam(input: { slamType?: SlamType; year?: number; dateRange?: string } = {}): Promise<EspnPreview> {
    const config = this.getSlamConfig(input.slamType ?? "french_open");
    const dateRange = input.dateRange ?? config.dateRange(input.year ?? new Date().getFullYear());
    const results = await Promise.all([this.fetchTourPreview("atp", dateRange, config), this.fetchTourPreview("wta", dateRange, config)]);
    const matches = this.dedupeMatches(results.flatMap((result) => result.matches));

    return {
      providerName: "EspnTennisProvider",
      checkedAt: new Date().toISOString(),
      experimental: true,
      dateRange,
      config: this.summarizeConfig(config),
      sources: results.map((result) => ({
        tour: result.tour,
        ok: result.ok,
        message: result.message,
        matchesCount: result.matches.length,
        scheduledCount: result.matches.filter((match) => match.status === "scheduled").length,
        liveCount: result.matches.filter((match) => match.status === "live").length,
        completedCount: result.matches.filter((match) => match.status === "completed" || match.status === "retired" || match.status === "walkover").length,
        reviewCount: result.matches.filter((match) => match.status === "needs_review").length
      })),
      totalMatchesCount: matches.length,
      scheduledCount: matches.filter((match) => match.status === "scheduled").length,
      liveCount: matches.filter((match) => match.status === "live").length,
      completedCount: matches.filter((match) => match.status === "completed" || match.status === "retired" || match.status === "walkover").length,
      reviewCount: matches.filter((match) => match.status === "needs_review").length,
      sampleScheduled: matches.filter((match) => match.status === "scheduled").slice(0, 8).map((match) => this.summarizeMatch(match)),
      sampleLive: matches.filter((match) => match.status === "live").slice(0, 20).map((match) => this.summarizeMatch(match)),
      sampleFinal: matches
        .filter((match) => match.status === "completed" || match.status === "retired" || match.status === "walkover" || match.status === "needs_review")
        .slice(0, 8)
        .map((match) => this.summarizeMatch(match)),
      rawPayload: {
        scoreboards: results.map((result) => ({
          tour: result.tour,
          ok: result.ok,
          message: result.message,
          scoreboard: result.scoreboard ?? null
        }))
      }
    };
  }

  async getPreviewMatches(input: { slamType?: SlamType; year?: number; dateRange?: string } = {}): Promise<ProviderMatch[]> {
    const config = this.getSlamConfig(input.slamType ?? "french_open");
    const dateRange = input.dateRange ?? config.dateRange(input.year ?? new Date().getFullYear());
    const results = await Promise.all([this.fetchTourPreview("atp", dateRange, config), this.fetchTourPreview("wta", dateRange, config)]);
    return this.dedupeMatches(results.flatMap((result) => result.matches));
  }

  async getDrawImportData(input: { slamType?: SlamType; year?: number; gender?: Gender } = {}): Promise<EspnDrawImportData> {
    const year = input.year ?? new Date().getFullYear();
    const gender = input.gender ?? "men";
    const config = this.getSlamConfig(input.slamType ?? "french_open");
    const tournamentId = config.espnTournamentId;
    const competitionType = gender === "women" ? config.womenCompetitionType : config.menCompetitionType;
    const html = await this.requestText(`https://www.espn.com/tennis/${config.espnSlug}/bracket/_/season/${year}/competitionType/${competitionType}`);
    const bracket = this.extractBracketPayload(html);
    const scoreboards = await this.getPreviewMatches({ slamType: config.slamType, year });
    const fullNameByProviderId = new Map<string, { name: string; country?: string | null }>();
    for (const match of scoreboards) {
      if (match.player1ProviderId && match.player1Name) fullNameByProviderId.set(match.player1ProviderId, { name: match.player1Name });
      if (match.player2ProviderId && match.player2Name) fullNameByProviderId.set(match.player2ProviderId, { name: match.player2Name });
    }

    const roundOne = bracket.matchups
      .filter((matchup: EspnBracketMatchup) => matchup.roundId === 1)
      .sort((a: EspnBracketMatchup, b: EspnBracketMatchup) => a.bracketLocation - b.bracketLocation);

    if (roundOne.length !== config.expectedFirstRoundSinglesMatches) {
      throw new Error(`ESPN bracket returned ${roundOne.length} first-round matches; expected ${config.expectedFirstRoundSinglesMatches}.`);
    }

    return {
      providerName: "EspnTennisProvider",
      tournamentName: bracket.name ?? config.displayName,
      tournamentId,
      eventType: gender === "women" ? "womens_singles" : "mens_singles",
      year,
      matchups: roundOne.map((matchup: EspnBracketMatchup) => {
        const matchNumber = matchup.bracketLocation;
        return {
          matchNumber,
          providerMatchId: this.makeProviderMatchId(matchup.matchupId ?? matchup.id),
          startTime: matchup.date ?? null,
          scoreSummary: null,
          player1: this.mapDrawSlot(matchup.competitorOne, matchNumber * 2 - 1, matchNumber, matchup, fullNameByProviderId),
          player2: this.mapDrawSlot(matchup.competitorTwo, matchNumber * 2, matchNumber, matchup, fullNameByProviderId)
        };
      }),
      rawPayload: bracket
    };
  }

  async getDrawMatchLinks(input: { slamType?: SlamType; year?: number; gender?: Gender } = {}): Promise<{ links: EspnDrawMatchLink[]; rawPayload: unknown }> {
    const year = input.year ?? new Date().getFullYear();
    const gender = input.gender ?? "men";
    const config = this.getSlamConfig(input.slamType ?? "french_open");
    const competitionType = gender === "women" ? config.womenCompetitionType : config.menCompetitionType;
    const html = await this.requestText(`https://www.espn.com/tennis/${config.espnSlug}/bracket/_/season/${year}/competitionType/${competitionType}`);
    const bracket = this.extractBracketPayload(html);

    return {
      links: bracket.matchups
        .filter((matchup: EspnBracketMatchup) => matchup.roundId >= 1 && matchup.roundId <= 7)
        .map((matchup: EspnBracketMatchup) => {
          const winner = matchup.competitorOne?.winner
            ? matchup.competitorOne
            : matchup.competitorTwo?.winner
              ? matchup.competitorTwo
              : null;
          return {
            roundNumber: matchup.roundId,
            matchNumber: matchup.bracketLocation,
            providerMatchId: this.makeProviderMatchId(matchup.matchupId ?? matchup.id),
            startTime: matchup.date ?? null,
            statusState: matchup.statusState ?? null,
            winnerProviderId: winner?.id ? this.makeProviderPlayerId(winner.id) : null,
            scoreSummary: this.summarizeBracketMatchup(matchup)
          };
        }),
      rawPayload: bracket
    };
  }

  private async fetchTourPreview(tour: EspnTour, dateRange: string, config: EspnGrandSlamConfig): Promise<ScoreboardResult> {
    try {
      let scoreboard = this.mergeScoreboards(await this.fetchScoreboard(tour, dateRange), await this.fetchScoreboard(tour));
      let events = (scoreboard.events ?? []).filter((event) => this.isTargetSlam(event, config));
      let matches = events.flatMap((event) => this.getEventCompetitions(event).map((competition) => this.mapCompetition(tour, event, competition)));

      if (matches.length === 0 && dateRange) {
        scoreboard = await this.fetchScoreboard(tour);
        events = (scoreboard.events ?? []).filter((event) => this.isTargetSlam(event, config));
        matches = events.flatMap((event) => this.getEventCompetitions(event).map((competition) => this.mapCompetition(tour, event, competition)));
      }

      return {
        tour,
        ok: true,
        message: events.length > 0
          ? `Found ${matches.length} ESPN ${tour.toUpperCase()} ${config.displayName} singles rows.`
          : `No ${config.displayName} rows found for ${tour.toUpperCase()}.`,
        scoreboard,
        matches
      };
    } catch (error) {
      return {
        tour,
        ok: false,
        message: error instanceof Error ? error.message : `Could not fetch ESPN ${tour.toUpperCase()} scoreboard.`,
        matches: []
      };
    }
  }

  private async fetchScoreboard(tour: EspnTour, dateRange?: string) {
    const params = new URLSearchParams();
    if (dateRange) params.set("dates", dateRange);
    params.set("_", Date.now().toString());
    const query = `?${params.toString()}`;
    return this.request<EspnScoreboard>(`/${tour}/scoreboard${query}`);
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Racket Bracket ESPN preview"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`ESPN tennis ${response.status}: ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }

  private async requestText(url: string): Promise<string> {
    const response = await fetch(`${url}?_=${Date.now()}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 Racket Bracket ESPN preview"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`ESPN bracket ${response.status}: ${await response.text()}`);
    }

    return response.text();
  }

  private extractBracketPayload(html: string): EspnBracketPayload {
    const marker = "window['__espnfitt__']=";
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) throw new Error("ESPN bracket page did not include embedded bracket state.");

    const jsonStart = markerIndex + marker.length;
    const jsonText = this.extractJsonObject(html, jsonStart);
    const state = JSON.parse(jsonText) as { page?: { content?: { bracket?: EspnBracketPayload } } };
    const bracket = state.page?.content?.bracket;
    if (!bracket?.matchups?.length) throw new Error("ESPN bracket state did not include matchups.");
    return bracket;
  }

  private extractJsonObject(source: string, start: number) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < source.length; index += 1) {
      const char = source[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
    }

    throw new Error("Could not parse ESPN bracket state.");
  }

  private mapCompetition(tour: EspnTour, event: EspnEvent, competition: EspnCompetition): ProviderMatch {
    const competitors = [...(competition.competitors ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const player1 = competitors[0];
    const player2 = competitors[1];
    let winner = competitors.find((competitor) => competitor.winner);
    const baseStatus = this.mapStatus(competition, competitors);
    let status = competitors.length === 2 ? baseStatus : "needs_review";

    // ESPN often finalizes a match in its result NOTE ("X bt Y …") before the
    // structured status/winner flips — common for retirements, where the status
    // can even still read "Scheduled". Trust the note as a winner signal when
    // there's no structured winner yet, so finished matches don't stay stuck.
    // This is re-derived every sync, so once ESPN's clean structured result
    // arrives the normal path takes over (and corrects it if it ever differs).
    if (!winner && status !== "completed" && competitors.length === 2) {
      const noteWinner = this.resolveNoteWinner(competition, player1, player2);
      if (noteWinner) {
        winner = noteWinner;
        status = "completed";
      }
    }

    return {
      providerMatchId: competition.id,
      providerEventId: event.id,
      tournamentName: event.name ?? event.shortName ?? null,
      tournamentId: competition.tournamentId ? String(competition.tournamentId) : event.id,
      roundName: competition.round?.displayName ?? null,
      eventType: this.getEventType(tour, competition),
      status,
      startTime: competition.startDate ?? competition.date ?? null,
      player1Name: this.getPlayerName(player1),
      player1ProviderId: player1?.id ? this.makeProviderPlayerId(player1.id) : null,
      player2Name: this.getPlayerName(player2),
      player2ProviderId: player2?.id ? this.makeProviderPlayerId(player2.id) : null,
      player1Linescores: this.mapLinescores(player1),
      player2Linescores: this.mapLinescores(player2),
      scoreSummary: this.getScoreSummary(competition, player1, player2),
      winnerName: this.getPlayerName(winner),
      winnerProviderId: winner?.id ? this.makeProviderPlayerId(winner.id) : null,
      rawPayload: competition
    };
  }

  private mapStatus(competition: EspnCompetition, competitors: EspnCompetitor[]): ProviderMatchStatus {
    const status = competition.status?.type;
    const text = [status?.name, status?.state, status?.description, status?.detail, status?.shortDetail, ...((competition.notes ?? []).map((note) => note.text))]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (text.includes("cancel")) return "cancelled";
    if (text.includes("walkover") || text.includes("w/o")) return "walkover";
    if (text.includes("retired") || text.includes("ret.")) return "retired";
    if (status?.completed) {
      const winnerCount = competitors.filter((competitor) => competitor.winner).length;
      return winnerCount === 1 ? "completed" : "needs_review";
    }
    if (status?.state === "in" || text.includes("in progress")) return "live";
    if (status?.state === "pre") return "scheduled";
    return "scheduled";
  }

  // Build a final-score line from the bracket payload, e.g. "N. Borges def.
  // T. Boyer 6-3 7-5 7-5". Used only for matches finalized via the bracket
  // fallback (the live scoreboard provides its own running summary).
  private summarizeBracketMatchup(matchup: EspnBracketMatchup): string | null {
    const one = matchup.competitorOne;
    const two = matchup.competitorTwo;
    if (!one || !two) return null;
    const sets = (one.scores ?? []).map((set, index) => {
      const a = set?.v ?? "";
      const b = two.scores?.[index]?.v ?? "";
      return a === "" && b === "" ? "" : `${a}-${b}`;
    }).filter(Boolean);
    if (sets.length === 0) return null;
    const winner = one.winner ? one : two.winner ? two : null;
    const loser = winner === one ? two : winner === two ? one : null;
    // Order the set scores from the winner's perspective when we know it.
    const ordered = winner === two
      ? sets.map((pair) => pair.split("-").reverse().join("-"))
      : sets;
    if (winner && loser) return `${winner.name} def. ${loser.name} ${ordered.join(" ")}`;
    return `${one.name} ${sets.join(" ")} ${two.name}`;
  }

  private getScoreSummary(competition: EspnCompetition, player1?: EspnCompetitor, player2?: EspnCompetitor) {
    const note = competition.notes?.find((item) => item.text)?.text;
    if (note) return note;

    const player1Scores = this.mapLinescores(player1).map((line) => line.displayValue).join("-");
    const player2Scores = this.mapLinescores(player2).map((line) => line.displayValue).join("-");
    if (!player1Scores && !player2Scores) return null;
    return `${player1Scores} / ${player2Scores}`;
  }

  private mapLinescores(competitor?: EspnCompetitor): ProviderLineScore[] {
    return (competitor?.linescores ?? []).map((line) => ({
      value: typeof line.value === "number" ? line.value : null,
      displayValue: line.displayValue ?? String(line.value ?? ""),
      tiebreak: typeof line.tiebreak === "number" ? line.tiebreak : null,
      winner: typeof line.winner === "boolean" ? line.winner : null
    }));
  }

  private getPlayerName(competitor?: EspnCompetitor) {
    return competitor?.athlete?.displayName ?? competitor?.athlete?.fullName ?? competitor?.athlete?.shortName ?? null;
  }

  // Parse ESPN's result note ("(28) Brandon Nakashima (USA) bt Jack Pinnington
  // Jones (GBR) 6-3 7-6 4-3") to find the winner. Returns a competitor only when
  // the split is unambiguous: exactly one player's name sits before the decisive
  // verb (bt / def.) and the other sits after. Anything ambiguous returns null so
  // the match is left untouched rather than risk a wrong winner.
  private resolveNoteWinner(competition: EspnCompetition, player1?: EspnCompetitor, player2?: EspnCompetitor): EspnCompetitor | null {
    if (!player1 || !player2) return null;
    const note = competition.notes?.find((item) => item.text)?.text;
    if (!note) return null;
    const lower = note.toLowerCase();
    const verb = lower.match(/\s(?:bt|def\.?)\s/);
    if (!verb || verb.index === undefined) return null;
    const before = lower.slice(0, verb.index);
    const after = lower.slice(verb.index + verb[0].length);
    const name1 = this.getPlayerName(player1)?.toLowerCase();
    const name2 = this.getPlayerName(player2)?.toLowerCase();
    if (!name1 || !name2) return null;
    if (before.includes(name1) && !after.includes(name1) && after.includes(name2) && !before.includes(name2)) return player1;
    if (before.includes(name2) && !after.includes(name2) && after.includes(name1) && !before.includes(name1)) return player2;
    return null;
  }

  private getEventType(tour: EspnTour, competition: EspnCompetition): ProviderMatch["eventType"] {
    const slug = competition.type?.slug?.toLowerCase() ?? "";
    if (slug.includes("women")) return "womens_singles";
    if (slug.includes("men")) return "mens_singles";
    return tour === "wta" ? "womens_singles" : "mens_singles";
  }

  private mapDrawSlot(
    competitor: EspnBracketCompetitor,
    position: number,
    matchNumber: number,
    matchup: EspnBracketMatchup,
    fullNameByProviderId: Map<string, { name: string; country?: string | null }>
  ): EspnDrawSlot {
    const playerProviderId = this.makeProviderPlayerId(competitor.id);
    const fullPlayer = fullNameByProviderId.get(playerProviderId);

    return {
      position,
      matchNumber,
      providerMatchId: this.makeProviderMatchId(matchup.matchupId ?? matchup.id),
      playerName: fullPlayer?.name ?? competitor.name,
      playerProviderId,
      seed: competitor.seed ? Number(competitor.seed) : null,
      country: fullPlayer?.country ?? this.getCountryFromLogo(competitor.logo)
    };
  }

  private getCountryFromLogo(logo?: string) {
    const match = logo?.match(/countries\/500\/([a-z]{3})\.png/i);
    return match?.[1]?.toUpperCase() ?? null;
  }

  private mergeScoreboards(primary: EspnScoreboard, current: EspnScoreboard): EspnScoreboard {
    return {
      ...primary,
      events: this.mergeEvents(primary.events ?? [], current.events ?? [])
    };
  }

  private mergeEvents(primaryEvents: EspnEvent[], currentEvents: EspnEvent[]) {
    const byId = new Map<string, EspnEvent>();
    for (const event of primaryEvents) byId.set(event.id, event);
    for (const currentEvent of currentEvents) {
      const existing = byId.get(currentEvent.id);
      byId.set(currentEvent.id, existing ? this.mergeEvent(existing, currentEvent) : currentEvent);
    }
    return Array.from(byId.values());
  }

  private mergeEvent(primary: EspnEvent, current: EspnEvent): EspnEvent {
    return {
      ...primary,
      competitions: this.dedupeCompetitions([...(primary.competitions ?? []), ...(current.competitions ?? [])]),
      groupings: this.mergeGroupings(primary.groupings ?? [], current.groupings ?? [])
    };
  }

  private mergeGroupings(primaryGroupings: NonNullable<EspnEvent["groupings"]>, currentGroupings: NonNullable<EspnEvent["groupings"]>) {
    const byKey = new Map<string, NonNullable<EspnEvent["groupings"]>[number]>();
    for (const grouping of primaryGroupings) byKey.set(this.getGroupingKey(grouping), grouping);
    for (const currentGrouping of currentGroupings) {
      const key = this.getGroupingKey(currentGrouping);
      const existing = byKey.get(key);
      byKey.set(key, existing ? {
        ...existing,
        competitions: this.dedupeCompetitions([...(existing.competitions ?? []), ...(currentGrouping.competitions ?? [])])
      } : currentGrouping);
    }
    return Array.from(byKey.values());
  }

  private getGroupingKey(grouping: NonNullable<EspnEvent["groupings"]>[number]) {
    return grouping.grouping?.slug ?? grouping.grouping?.id ?? grouping.grouping?.displayName ?? "unknown";
  }

  private dedupeCompetitions(competitions: EspnCompetition[]) {
    const byId = new Map<string, EspnCompetition>();
    for (const competition of competitions) {
      byId.set(competition.id, {
        ...byId.get(competition.id),
        ...competition
      });
    }
    return Array.from(byId.values());
  }

  private isTargetSlam(event: EspnEvent, config: EspnGrandSlamConfig) {
    const name = `${event.name ?? ""} ${event.shortName ?? ""}`.toLowerCase();
    return config.aliases.some((alias) => name.includes(alias));
  }

  private getSlamConfig(slamType: SlamType) {
    return espnGrandSlamConfigs[slamType];
  }

  private summarizeConfig(config: EspnGrandSlamConfig): EspnPreview["config"] {
    return {
      slamType: config.slamType,
      displayName: config.displayName,
      espnSlug: config.espnSlug,
      espnTournamentId: config.espnTournamentId,
      expectedFirstRoundSinglesMatches: config.expectedFirstRoundSinglesMatches,
      expectedTotalSinglesMatches: config.expectedTotalSinglesMatches,
      verified: config.verified,
      notes: config.notes
    };
  }

  private summarizeMatch(match: ProviderMatch): EspnPreviewMatch {
    return {
      providerMatchId: this.makeProviderMatchId(match.providerMatchId),
      tournamentName: match.tournamentName ?? null,
      roundName: match.roundName ?? null,
      eventType: match.eventType,
      status: match.status,
      player1: match.player1Name ?? "TBD",
      player2: match.player2Name ?? "TBD",
      score: match.scoreSummary ?? null,
      winner: match.winnerName ?? null,
      startTime: match.startTime ?? null
    };
  }

  private dedupeMatches(matches: ProviderMatch[]) {
    const byId = new Map<string, ProviderMatch>();
    for (const match of matches) {
      byId.set(match.providerMatchId, byId.get(match.providerMatchId) ?? match);
    }
    return Array.from(byId.values());
  }

  private getAllPreviewMatches(preview: EspnPreview) {
    const rawPayload = preview.rawPayload as { scoreboards?: Array<{ tour: EspnTour; scoreboard?: EspnScoreboard | null }> };
    const config = this.getSlamConfig(preview.config.slamType);
    return this.dedupeMatches((rawPayload.scoreboards ?? []).flatMap((source) =>
      (source.scoreboard?.events ?? [])
        .filter((event) => this.isTargetSlam(event, config))
        .flatMap((event) => this.getEventCompetitions(event).map((competition) => this.mapCompetition(source.tour, event, competition)))
    ));
  }

  private getEventCompetitions(event: EspnEvent) {
    return [
      ...(event.competitions ?? []),
      ...(event.groupings ?? [])
        .filter((grouping) => this.isSinglesGrouping(grouping))
        .flatMap((grouping) => grouping.competitions ?? [])
    ];
  }

  private isSinglesGrouping(grouping: NonNullable<EspnEvent["groupings"]>[number]) {
    const slug = grouping.grouping?.slug?.toLowerCase() ?? "";
    const displayName = grouping.grouping?.displayName?.toLowerCase() ?? "";
    return slug.includes("singles") || displayName.includes("singles");
  }

  private makeProviderMatchId(matchId: string) {
    return matchId.startsWith("espn-match-") ? matchId : `espn-match-${matchId}`;
  }

  private makeProviderPlayerId(playerId: string) {
    return playerId.startsWith("espn-player-") ? playerId : `espn-player-${playerId}`;
  }
}
