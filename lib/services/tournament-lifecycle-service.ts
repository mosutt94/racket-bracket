import { getTennisDataProvider } from "@/lib/providers/provider-service";
import { initialState } from "@/lib/seed";
import { recalculateScores } from "@/lib/services/scoring-service";
import type {
  AppState,
  CompletedMatchData,
  DrawSlot,
  Match,
  Player,
  PoolTournament,
  ProviderSyncRun,
  Tournament,
  TournamentInstance,
  TournamentRound,
  UpcomingGrandSlam
} from "@/lib/types";
import { makeId } from "@/lib/utils";

const providerName = "MockTennisDataProvider";

export async function getNextGrandSlamSuggestion(now = new Date()): Promise<UpcomingGrandSlam | null> {
  const provider = getTennisDataProvider("mock");
  const events = await provider.listUpcomingGrandSlams();
  const activeOrFuture = events
    .filter((event) => new Date(event.finalStartsAt).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.mainDrawStartsAt).getTime() - new Date(b.mainDrawStartsAt).getTime());
  return activeOrFuture[0] ?? events[0] ?? null;
}

export async function activateUpcomingGrandSlamForPool(state: AppState, poolId: string, event?: UpcomingGrandSlam | null): Promise<AppState> {
  const suggestion = event ?? (await getNextGrandSlamSuggestion());
  if (!suggestion) return state;

  const existingInstance = state.tournamentInstances.find(
    (instance) =>
      instance.slamType === suggestion.slamType &&
      instance.year === suggestion.year &&
      instance.gender === suggestion.gender
  );
  const instance = existingInstance ?? (await getTennisDataProvider("mock").getTournamentInstance(suggestion.slamType, suggestion.year, suggestion.gender));
  const existingPoolTournament = state.poolTournaments.find(
    (item) => item.poolId === poolId && item.tournamentInstanceId === instance.id
  );
  if (existingPoolTournament) return state;

  const tournamentId = makeId("tournament");
  const tournament: Tournament = {
    id: tournamentId,
    tournamentInstanceId: instance.id,
    name: instance.name,
    slamType: instance.slamType,
    year: instance.year,
    gender: instance.gender,
    status: getTournamentStatusFromInstance(instance),
    bracketSize: instance.bracketSize,
    pickingDeadline: instance.mainDrawStartsAt,
    createdAt: new Date().toISOString(),
    externalProviderId: instance.externalProviderId,
    lastSyncedAt: null
  };
  const poolTournament: PoolTournament = {
    id: makeId("pool_tournament"),
    poolId,
    tournamentId,
    tournamentInstanceId: instance.id,
    pickingDeadline: instance.mainDrawStartsAt,
    lockedAt: null,
    commissionerNotes: "Auto-activated from next Grand Slam suggestion.",
    createdAt: new Date().toISOString()
  };
  const bundle = cloneMockDrawForTournament(tournament, instance);

  return {
    ...state,
    tournamentInstances: existingInstance ? state.tournamentInstances : [...state.tournamentInstances, instance],
    poolTournaments: [...state.poolTournaments, poolTournament],
    tournaments: [...state.tournaments, tournament],
    rounds: [...state.rounds, ...bundle.rounds],
    matches: [...state.matches, ...bundle.matches],
    players: upsertPlayers(state.players, bundle.players),
    drawSlots: upsertDrawSlots(state.drawSlots, bundle.drawSlots)
  };
}

export async function syncTournamentLifecycle(state: AppState, tournamentId: string, syncType: "draw" | "match_updates" | "manual" = "manual"): Promise<AppState> {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament?.tournamentInstanceId) return state;

  const startedAt = new Date().toISOString();
  const runId = makeId("sync");
  try {
    const withDraw = syncType === "match_updates" ? state : await syncDraw(state, tournament.id);
    const withResolvedQualifiers = resolveMockQualifiers(withDraw, tournament.tournamentInstanceId);
    const withUpdates = await syncMatchUpdates(withResolvedQualifiers, tournament.id);
    const withLock = lockTournamentIfMainDrawStarted(withUpdates, tournament.id);
    const rescored = recalculateScores(withLock, tournament.id);
    return {
      ...rescored,
      providerSyncRuns: [
        ...rescored.providerSyncRuns,
        makeSyncRun(runId, tournament, syncType, "success", startedAt, null)
      ]
    };
  } catch (error) {
    return {
      ...state,
      providerSyncRuns: [
        ...state.providerSyncRuns,
        makeSyncRun(runId, tournament, syncType, "failed", startedAt, error instanceof Error ? error.message : "Unknown sync error")
      ]
    };
  }
}

async function syncDraw(state: AppState, tournamentId: string): Promise<AppState> {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament?.tournamentInstanceId) return state;

  const draw = await getTennisDataProvider("mock").getDraw(tournament.tournamentInstanceId);
  const instance = draw.tournamentInstance;
  const currentTournamentMatches = state.matches.filter((match) => match.tournamentId === tournamentId);
  const bundle = currentTournamentMatches.length === 127 ? null : cloneMockDrawForTournament(tournament, instance);

  return {
    ...state,
    tournamentInstances: state.tournamentInstances.map((item) =>
      item.id === tournament.tournamentInstanceId
        ? { ...item, status: instance?.status ?? item.status, lastSyncedAt: new Date().toISOString() }
        : item
    ),
    tournaments: state.tournaments.map((item) =>
      item.id === tournamentId
        ? { ...item, status: getTournamentStatusFromInstance(instance), lastSyncedAt: new Date().toISOString() }
        : item
    ),
    players: upsertPlayers(state.players, draw.players),
    drawSlots: upsertDrawSlots(state.drawSlots, draw.drawSlots ?? []),
    rounds: bundle ? [...state.rounds.filter((round) => round.tournamentId !== tournamentId), ...bundle.rounds] : state.rounds,
    matches: bundle ? [...state.matches.filter((match) => match.tournamentId !== tournamentId), ...bundle.matches] : state.matches
  };
}

async function syncMatchUpdates(state: AppState, tournamentId: string): Promise<AppState> {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament?.tournamentInstanceId) return state;

  const updates = await getTennisDataProvider("mock").getMatchUpdates(tournament.tournamentInstanceId);
  const playersByExternalId = new Map(state.players.map((player) => [player.externalProviderId, player.id]));
  const lockedOverrideMatchIds = new Set(
    state.manualOverrides
      .filter((override) => override.tournamentId === tournamentId && override.locked && (override.overrideType === "match_winner" || override.overrideType === "match_score"))
      .map((override) => override.matchId)
      .filter(Boolean)
  );

  const matches = state.matches.map((match) => {
    if (match.tournamentId !== tournamentId || lockedOverrideMatchIds.has(match.id)) return match;
    const update = updates.find((item) => providerMatchIdsEqual(match.externalProviderMatchId, item.externalProviderMatchId));
    if (!update) return match;
    const winnerPlayerId = isCompletedMatch(update) ? playersByExternalId.get(update.winnerExternalProviderId) ?? match.winnerPlayerId : match.winnerPlayerId;
    return {
      ...match,
      status: update.status,
      scoreSummary: update.scoreSummary ?? match.scoreSummary,
      winnerPlayerId,
      updatedAt: new Date().toISOString()
    };
  });

  return {
    ...state,
    matches,
    tournaments: state.tournaments.map((item) =>
      item.id === tournamentId ? { ...item, lastSyncedAt: new Date().toISOString() } : item
    )
  };
}

export function lockTournamentIfMainDrawStarted(state: AppState, tournamentId: string, now = new Date()): AppState {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  const instance = state.tournamentInstances.find((item) => item.id === tournament?.tournamentInstanceId);
  if (!tournament || !instance || new Date(instance.mainDrawStartsAt).getTime() > now.getTime()) return state;

  return {
    ...state,
    tournaments: state.tournaments.map((item) =>
      item.id === tournamentId && item.status === "picking_open" ? { ...item, status: "locked" } : item
    ),
    poolTournaments: state.poolTournaments.map((item) =>
      item.tournamentId === tournamentId && !item.lockedAt ? { ...item, lockedAt: now.toISOString() } : item
    ),
    brackets: state.brackets.map((bracket) =>
      bracket.tournamentId === tournamentId && bracket.status === "submitted"
        ? { ...bracket, status: "locked", lockedAt: bracket.lockedAt ?? now.toISOString() }
        : bracket
    )
  };
}

export function resolveMockQualifiers(state: AppState, tournamentInstanceId: string): AppState {
  const resolvedNames = [
    "Mason Clay", "Enzo Navarro", "Sasha Klein", "Bruno Vidal", "Kaito Mori", "Evan Rocher", "Luis Ortega", "Mikael Stone",
    "Ibrahim Nadir", "Roman Hale", "Ari Novak", "Yuri Campos", "Ben Adler", "Dario Conti", "Oliver Vale", "Stefan Rios"
  ];
  const unresolvedSlots = state.drawSlots.filter(
    (slot) => slot.tournamentInstanceId === tournamentInstanceId && slot.placeholderLabel && !slot.resolvedAt
  );
  if (unresolvedSlots.length === 0) return state;

  const playerIds = new Set(unresolvedSlots.map((slot) => slot.playerId));
  const players = state.players.map((player) => {
    if (!playerIds.has(player.id)) return player;
    const index = unresolvedSlots.findIndex((slot) => slot.playerId === player.id);
    return {
      ...player,
      name: resolvedNames[index] ?? `Resolved Qualifier ${index + 1}`,
      country: ["USA", "ESP", "GER", "FRA", "JPN", "ARG", "ITA", "AUS"][index % 8],
      externalProviderId: player.externalProviderId ?? `mock-resolved-${player.id}`
    };
  });
  const drawSlots = state.drawSlots.map((slot) =>
    slot.tournamentInstanceId === tournamentInstanceId && playerIds.has(slot.playerId)
      ? { ...slot, placeholderLabel: null, resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : slot
  );

  return {
    ...state,
    players,
    drawSlots,
    tournamentInstances: state.tournamentInstances.map((instance) =>
      instance.id === tournamentInstanceId ? { ...instance, status: "draw_ready", lastSyncedAt: new Date().toISOString() } : instance
    )
  };
}

function cloneMockDrawForTournament(tournament: Tournament, instance?: TournamentInstance) {
  const roundId = makeId("round");
  const rounds: TournamentRound[] = initialState.rounds
    .filter((round) => round.tournamentId === "tournament_french_2026_men")
    .map((round) => ({ ...round, id: `${roundId}_${round.roundNumber}`, tournamentId: tournament.id }));
  const matchIdBySeedId = new Map<string, string>();
  const seedMatches = initialState.matches.filter((match) => match.tournamentId === "tournament_french_2026_men");
  for (const match of seedMatches) matchIdBySeedId.set(match.id, makeId("match"));
  const matches: Match[] = seedMatches.map((match) => ({
    ...match,
    id: matchIdBySeedId.get(match.id) ?? makeId("match"),
    tournamentId: tournament.id,
    tournamentInstanceId: tournament.tournamentInstanceId,
    winnerPlayerId: null,
    winnerDrawSlotId: null,
    status: "scheduled",
    scoreSummary: null,
    externalProviderMatchId: match.externalProviderMatchId,
    nextMatchId: match.nextMatchId ? matchIdBySeedId.get(match.nextMatchId) ?? null : null,
    updatedAt: new Date().toISOString()
  }));
  const drawSlots: DrawSlot[] = initialState.drawSlots.map((slot) => ({
    ...slot,
    id: `${instance?.id ?? tournament.tournamentInstanceId ?? tournament.id}_slot_${slot.position}`,
    tournamentInstanceId: instance?.id ?? tournament.tournamentInstanceId ?? tournament.id
  }));
  return { rounds, matches, players: initialState.players, drawSlots };
}

function upsertPlayers(existing: Player[], incoming: Player[]) {
  const byId = new Map(existing.map((player) => [player.id, player]));
  for (const player of incoming) byId.set(player.id, { ...byId.get(player.id), ...player });
  return Array.from(byId.values());
}

function upsertDrawSlots(existing: DrawSlot[], incoming: DrawSlot[]) {
  const byKey = new Map(existing.map((slot) => [`${slot.tournamentInstanceId}:${slot.position}`, slot]));
  for (const slot of incoming) byKey.set(`${slot.tournamentInstanceId}:${slot.position}`, { ...byKey.get(`${slot.tournamentInstanceId}:${slot.position}`), ...slot });
  return Array.from(byKey.values());
}

function getTournamentStatusFromInstance(instance?: TournamentInstance): Tournament["status"] {
  if (!instance) return "setup";
  if (instance.status === "scheduled" || instance.status === "draw_pending") return "setup";
  if (instance.status === "in_progress") return "in_progress";
  if (instance.status === "completed") return "completed";
  return "picking_open";
}

function makeSyncRun(
  id: string,
  tournament: Tournament,
  syncType: ProviderSyncRun["syncType"],
  status: ProviderSyncRun["status"],
  startedAt: string,
  errorMessage: string | null
): ProviderSyncRun {
  return {
    id,
    tournamentInstanceId: tournament.tournamentInstanceId ?? tournament.id,
    tournamentId: tournament.id,
    providerName,
    syncType,
    status,
    startedAt,
    finishedAt: new Date().toISOString(),
    errorMessage
  };
}

function providerMatchIdsEqual(localId?: string | null, providerId?: string | null) {
  if (!localId || !providerId) return false;
  return localId === providerId || localId.startsWith(`${providerId}-`);
}

function isCompletedMatch(value: unknown): value is CompletedMatchData {
  return typeof value === "object" && value !== null && "winnerExternalProviderId" in value;
}
