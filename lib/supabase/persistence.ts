import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { recalculateScores } from "@/lib/services/scoring-service";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import type { EspnDrawImportData } from "@/lib/providers/espn-tennis-provider";
import {
  getDefaultBracketShellMatchPlan,
  getDefaultDrawSlotPlan,
  getDefaultRoundDefinitions,
  getSlamCalendarDefaults,
  getSlamDisplayName
} from "@/lib/services/bracket-shell-service";
import { createUuid } from "@/lib/uuid";
import type { AppState, BracketStatus, Gender, Match, MatchStatus, NextMatchSlot, PoolRole, ProviderMatch, SlamType, TournamentStatus } from "@/lib/types";

type SupabaseClient = ReturnType<typeof createSupabaseServiceClient>;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient {
  return createSupabaseServiceClient();
}

/**
 * Page through a Supabase query in 1000-row batches. PostgREST caps any single
 * response at max_rows (default 1000), so for tables that scale with pool count
 * (matches, bracket_picks) we MUST paginate or rows go missing silently.
 */
async function fetchAllRows(buildQuery: (from: number, to: number) => any): Promise<any[]> {
  const pageSize = 1000;
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    throwIfError(error);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
    from += pageSize;
  }
}

function randomInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function mapPool(row: any) {
  return {
    id: row.id,
    name: row.name,
    commissionerUserId: row.commissioner_user_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at
  };
}

function mapPoolMember(row: any) {
  return {
    id: row.id,
    poolId: row.pool_id,
    userId: row.user_id,
    role: row.role as PoolRole,
    joinedAt: row.joined_at
  };
}

function mapBracket(row: any) {
  return {
    id: row.id,
    poolId: row.pool_id,
    tournamentId: row.tournament_id,
    userId: row.user_id,
    submittedAt: row.submitted_at,
    lockedAt: row.locked_at,
    totalScore: row.total_score,
    status: row.status as BracketStatus
  };
}

function mapBracketPick(row: any) {
  return {
    id: row.id,
    bracketId: row.bracket_id,
    matchId: row.match_id,
    pickedWinnerPlayerId: row.picked_winner_player_id,
    isCorrect: row.is_correct,
    pointsAwarded: row.points_awarded
  };
}

function mapProfile(row: any) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at
  };
}

function mapTournament(row: any) {
  return {
    id: row.id,
    tournamentInstanceId: row.tournament_instance_id,
    name: row.name,
    slamType: row.slam_type as SlamType,
    year: row.year,
    gender: row.gender as Gender,
    status: row.status as TournamentStatus,
    bracketSize: row.bracket_size,
    pickingDeadline: row.picking_deadline,
    createdAt: row.created_at,
    externalProviderId: row.external_provider_id,
    lastSyncedAt: row.last_synced_at
  };
}

function mapRound(row: any) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    roundNumber: row.round_number,
    roundName: row.round_name,
    pointsPerCorrectPick: row.points_per_correct_pick
  };
}

function mapPlayer(row: any) {
  return {
    id: row.id,
    externalProviderId: row.external_provider_id,
    name: row.name,
    country: row.country,
    seed: row.seed
  };
}

function mapMatch(row: any) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    tournamentInstanceId: row.tournament_instance_id,
    roundNumber: row.round_number,
    matchNumber: row.match_number,
    player1DrawSlotId: row.player1_draw_slot_id,
    player2DrawSlotId: row.player2_draw_slot_id,
    winnerDrawSlotId: row.winner_draw_slot_id,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    winnerPlayerId: row.winner_player_id,
    status: row.status as MatchStatus,
    startTime: row.start_time,
    scoreSummary: row.score_summary,
    externalProviderMatchId: row.external_provider_match_id,
    nextMatchId: row.next_match_id,
    nextMatchSlot: row.next_match_slot as NextMatchSlot | null,
    updatedAt: row.updated_at
  };
}

function mapTournamentInstance(row: any) {
  return {
    id: row.id,
    name: row.name,
    slamType: row.slam_type as SlamType,
    year: row.year,
    gender: row.gender as Gender,
    status: row.status,
    bracketSize: row.bracket_size,
    qualifyingStartsAt: row.qualifying_starts_at,
    mainDrawStartsAt: row.main_draw_starts_at,
    finalStartsAt: row.final_starts_at,
    providerName: row.provider_name,
    externalProviderId: row.external_provider_id,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at
  };
}

function mapPoolTournament(row: any) {
  return {
    id: row.id,
    poolId: row.pool_id,
    tournamentId: row.tournament_id,
    tournamentInstanceId: row.tournament_instance_id,
    pickingDeadline: row.picking_deadline,
    lockedAt: row.locked_at,
    commissionerNotes: row.commissioner_notes,
    createdAt: row.created_at
  };
}

function mapDrawSlot(row: any) {
  return {
    id: row.id,
    tournamentInstanceId: row.tournament_instance_id,
    position: row.position,
    side: row.side,
    section: row.section,
    seed: row.seed,
    playerId: row.player_id,
    placeholderLabel: row.placeholder_label,
    resolvedAt: row.resolved_at,
    externalProviderSlotId: row.external_provider_slot_id,
    updatedAt: row.updated_at
  };
}

function mapProviderSyncRun(row: any) {
  return {
    id: row.id,
    tournamentInstanceId: row.tournament_instance_id,
    tournamentId: row.tournament_id,
    providerName: row.provider_name,
    syncType: row.sync_type,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    errorMessage: row.error_message,
    rawSnapshotId: row.raw_snapshot_id
  };
}

function mapManualOverride(row: any) {
  return {
    id: row.id,
    tournamentInstanceId: row.tournament_instance_id,
    tournamentId: row.tournament_id,
    matchId: row.match_id,
    drawSlotId: row.draw_slot_id,
    overrideType: row.override_type,
    locked: row.locked,
    value: row.value ?? {},
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at
  };
}

function throwIfError(error: unknown) {
  if (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "Supabase request failed.";
    throw new Error(message);
  }
}

export async function listPools(userId?: string | null) {
  const supabase = getClient();

  if (userId) {
    const { data, error } = await supabase
      .from("pool_members")
      .select("*, pools(*)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false });

    throwIfError(error);

    return {
      pools: (data ?? []).map((row: any) => mapPool(row.pools)).filter(Boolean),
      memberships: (data ?? []).map(mapPoolMember)
    };
  }

  const { data, error } = await supabase.from("pools").select("*").order("created_at", { ascending: false });
  throwIfError(error);
  return { pools: (data ?? []).map(mapPool), memberships: [] };
}

export async function getAppStateFromSupabase(): Promise<AppState> {
  const supabase = getClient();
  const [
    profiles,
    pools,
    poolMembers,
    tournaments,
    rounds,
    players,
    matches,
    tournamentInstances,
    poolTournaments,
    drawSlots,
    providerSyncRuns,
    manualOverrides,
    tennisDataProviders
  ] = await Promise.all([
    supabase.from("profiles").select("*").range(0, 9999),
    supabase.from("pools").select("*").range(0, 9999),
    supabase.from("pool_members").select("*").range(0, 9999),
    supabase.from("tournaments").select("*").range(0, 9999),
    supabase.from("tournament_rounds").select("*").range(0, 9999),
    supabase.from("players").select("*").range(0, 9999),
    // matches can exceed PostgREST's 1000-row cap (~8 pools × 127 matches), so page.
    fetchAllRows((from, to) => supabase.from("matches").select("*").range(from, to)).then((data) => ({ data, error: null })),
    supabase.from("tournament_instances").select("*").range(0, 9999),
    supabase.from("pool_tournaments").select("*").range(0, 9999),
    supabase.from("draw_slots").select("*").range(0, 9999),
    supabase.from("provider_sync_runs").select("*").order("started_at", { ascending: false }).range(0, 9999),
    supabase.from("manual_overrides").select("*").order("created_at", { ascending: false }).range(0, 9999),
    supabase.from("tennis_data_providers").select("*").range(0, 9999)
  ]);

  [
    profiles.error,
    pools.error,
    poolMembers.error,
    tournaments.error,
    rounds.error,
    players.error,
    matches.error,
    tournamentInstances.error,
    poolTournaments.error,
    drawSlots.error,
    providerSyncRuns.error,
    manualOverrides.error,
    tennisDataProviders.error
  ].forEach(throwIfError);

  const bracketBundle = await getBracketBundle({});

  return {
    profiles: (profiles.data ?? []).map(mapProfile),
    pools: (pools.data ?? []).map(mapPool),
    poolMembers: (poolMembers.data ?? []).map(mapPoolMember),
    tournaments: (tournaments.data ?? []).map(mapTournament),
    rounds: (rounds.data ?? []).map(mapRound),
    players: (players.data ?? []).map(mapPlayer),
    matches: (matches.data ?? []).map(mapMatch),
    brackets: bracketBundle.brackets,
    bracketPicks: bracketBundle.picks,
    scoreEvents: [],
    liveScoreSnapshots: [],
    tournamentInstances: (tournamentInstances.data ?? []).map(mapTournamentInstance),
    poolTournaments: (poolTournaments.data ?? []).map(mapPoolTournament),
    drawSlots: (drawSlots.data ?? []).map(mapDrawSlot),
    providerSyncRuns: (providerSyncRuns.data ?? []).map(mapProviderSyncRun),
    manualOverrides: (manualOverrides.data ?? []).map(mapManualOverride),
    tennisDataProviders: (tennisDataProviders.data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      enabled: row.enabled,
      config: row.config,
      createdAt: row.created_at
    }))
  };
}

export async function createPool(input: {
  name: string;
  commissionerUserId: string;
  inviteCode?: string;
  slamType: SlamType;
  year: number;
  gender: Gender;
}) {
  const supabase = getClient();
  const inviteCode = input.inviteCode?.trim().toUpperCase() || randomInviteCode();

  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .insert({
      name: input.name,
      commissioner_user_id: input.commissionerUserId,
      invite_code: inviteCode
    })
    .select("*")
    .single();

  throwIfError(poolError);

  const { data: member, error: memberError } = await supabase
    .from("pool_members")
    .insert({
      pool_id: pool.id,
      user_id: input.commissionerUserId,
      role: "commissioner"
    })
    .select("*")
    .single();

  throwIfError(memberError);

  const tournamentBundle = await createGrandSlamBracketForPool(supabase, {
    poolId: pool.id,
    slamType: input.slamType,
    year: input.year,
    gender: input.gender
  });

  return { pool: mapPool(pool), membership: mapPoolMember(member), ...tournamentBundle };
}

export async function createPoolByEmail(input: {
  name: string;
  email: string;
  displayName: string;
  inviteCode?: string;
  slamType: SlamType;
  year: number;
  gender: Gender;
}) {
  const supabase = getClient();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!input.name.trim()) throw new Error("Pool name is required.");
  if (!email || !displayName) throw new Error("Commissioner email and display name are required.");

  const profile = await getOrCreateProfileByEmail(supabase, { email, displayName });
  const result = await createPool({
    name: input.name,
    commissionerUserId: profile.id,
    inviteCode: input.inviteCode,
    slamType: input.slamType,
    year: input.year,
    gender: input.gender
  });
  return { ...result, profile };
}

export async function getOrCreateProfileByEmailAndAuthenticate(input: { email: string; displayName: string }) {
  return getOrCreateProfileByEmail(getClient(), input);
}

/** Lookup-only: returns the profile for an email, or null if none exists (no creation). */
export async function findProfileByEmail(email: string) {
  const { data, error } = await getClient()
    .from("profiles")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  throwIfError(error);
  return data ? mapProfile(data) : null;
}

export async function setTournamentStatusInSupabase(input: {
  tournamentId: string;
  status: TournamentStatus;
}) {
  const supabase = getClient();
  const now = new Date().toISOString();

  // Reflect status on both the per-pool tournament and the shared instance.
  const tournamentUpdate = supabase.from("tournaments").update({ status: input.status }).eq("id", input.tournamentId);
  const { data: tournament, error: tournamentLookupError } = await supabase
    .from("tournaments")
    .select("tournament_instance_id")
    .eq("id", input.tournamentId)
    .maybeSingle();
  throwIfError(tournamentLookupError);

  throwIfError((await tournamentUpdate).error);

  // Mirror picking_open / locked onto the pool_tournaments.locked_at column.
  if (input.status === "locked") {
    throwIfError((await supabase.from("pool_tournaments").update({ locked_at: now }).eq("tournament_id", input.tournamentId)).error);
  } else if (input.status === "picking_open") {
    throwIfError((await supabase.from("pool_tournaments").update({ locked_at: null }).eq("tournament_id", input.tournamentId)).error);
  }

  if (tournament?.tournament_instance_id) {
    const instanceStatus =
      input.status === "completed" ? "completed" :
      input.status === "in_progress" || input.status === "locked" ? "in_progress" :
      "draw_ready";
    throwIfError((await supabase.from("tournament_instances").update({ status: instanceStatus, last_synced_at: now }).eq("id", tournament.tournament_instance_id)).error);
  }
}

export async function updateTournamentScoringInSupabase(input: {
  tournamentId: string;
  rounds: Array<{ roundNumber: number; pointsPerCorrectPick: number }>;
}) {
  const supabase = getClient();

  // Update one row per round. Small enough to fire in parallel.
  const updates = input.rounds.map((round) =>
    supabase
      .from("tournament_rounds")
      .update({ points_per_correct_pick: round.pointsPerCorrectPick })
      .eq("tournament_id", input.tournamentId)
      .eq("round_number", round.roundNumber)
  );
  const results = await Promise.all(updates);
  for (const result of results) throwIfError(result.error);

  // Points changed → re-score all picks in this tournament.
  return recalculateTournamentScoresInSupabase(input.tournamentId);
}

async function getOrCreateProfileByEmail(supabase: SupabaseClient, input: { email: string; displayName: string }) {
  // Normalize here so every caller (sign-in, join, create) resolves to the same
  // profile. Looking up a raw, differently-cased email used to miss the existing
  // row and create a duplicate profile, splitting a person across two ids.
  const email = input.email.trim().toLowerCase();
  const { data: existingProfile, error: profileLookupError } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  throwIfError(profileLookupError);

  if (!existingProfile) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: input.displayName }
    });
    throwIfError(authError);
    if (!authUser.user) throw new Error("Could not create profile for this email.");

    const { data: insertedProfile, error: insertProfileError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.user.id,
        email,
        display_name: input.displayName
      })
      .select("*")
      .single();
    throwIfError(insertProfileError);
    return mapProfile(insertedProfile);
  }

  if (existingProfile.display_name !== input.displayName) {
    const { data: updatedProfile, error: updateProfileError } = await supabase
      .from("profiles")
      .update({ display_name: input.displayName })
      .eq("id", existingProfile.id)
      .select("*")
      .single();
    throwIfError(updateProfileError);
    return mapProfile(updatedProfile);
  }

  return mapProfile(existingProfile);
}

/**
 * Attaches a pool to the shared bracket for a Grand Slam. If this is the first pool
 * for (slam_type, year, gender), creates the tournament + 7 rounds + 128 players +
 * 128 draw_slots + 127 matches once, then imports the real ESPN draw. Subsequent
 * pools for the same Slam reuse the existing rows — no duplicated matches.
 */
async function createGrandSlamBracketForPool(
  supabase: SupabaseClient,
  input: { poolId: string; slamType: SlamType; year: number; gender: Gender }
) {
  const tournamentInstance = await getOrCreateTournamentInstance(supabase, {
    slamType: input.slamType,
    year: input.year,
    gender: input.gender
  });
  const pickingDeadline = getFreshPickingDeadline(tournamentInstance.main_draw_starts_at);

  const { tournament, freshlyCreated } = await getOrCreateSharedTournament(supabase, {
    slamType: input.slamType,
    year: input.year,
    gender: input.gender,
    tournamentInstanceId: tournamentInstance.id,
    pickingDeadline,
    externalProviderId: tournamentInstance.external_provider_id
  });

  // Pool → tournament join (per-pool picking deadline + lock state).
  const { error: poolTournamentError } = await supabase.from("pool_tournaments").insert({
    pool_id: input.poolId,
    tournament_id: tournament.id,
    tournament_instance_id: tournamentInstance.id,
    picking_deadline: pickingDeadline,
    locked_at: null,
    commissioner_notes: "Active Grand Slam draw for this pool."
  });
  throwIfError(poolTournamentError);

  // First pool for this Slam? Build the bracket shell + import ESPN once.
  // Otherwise we're reusing an existing populated tournament — no extra work needed.
  let drawImport: { ok: true; result: unknown } | { ok: false; error: string } | { ok: true; reused: true };

  if (freshlyCreated) {
    const { error: insertRoundsError } = await supabase.from("tournament_rounds").insert(
      getDefaultRoundDefinitions().map((round) => ({
        tournament_id: tournament.id,
        round_number: round.roundNumber,
        round_name: round.roundName,
        points_per_correct_pick: round.pointsPerCorrectPick
      }))
    );
    throwIfError(insertRoundsError);

    const drawSlotsByPosition = await getOrCreateDrawSlotsForInstance(supabase, tournamentInstance.id);
    await insertBracketShellMatchesForTournament(supabase, {
      tournamentId: tournament.id,
      tournamentInstanceId: tournamentInstance.id,
      drawSlotsByPosition
    });

    try {
      const provider = new EspnTennisProvider();
      const draw = await provider.getDrawImportData({
        slamType: input.slamType,
        year: input.year,
        gender: input.gender
      });
      const result = await importEspnDrawInSupabase({ tournamentId: tournament.id, draw });
      drawImport = { ok: true, result };
    } catch (error) {
      drawImport = {
        ok: false,
        error: error instanceof Error ? error.message : "Could not import ESPN draw."
      };
    }
  } else {
    drawImport = { ok: true, reused: true };
  }

  return { tournament: mapTournament(tournament), drawImport };
}

async function getOrCreateSharedTournament(
  supabase: SupabaseClient,
  input: {
    slamType: SlamType;
    year: number;
    gender: Gender;
    tournamentInstanceId: string;
    pickingDeadline: string;
    externalProviderId: string | null;
  }
) {
  const { data: existing, error: lookupError } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slam_type", input.slamType)
    .eq("year", input.year)
    .eq("gender", input.gender)
    .maybeSingle();
  throwIfError(lookupError);
  if (existing) return { tournament: existing, freshlyCreated: false };

  const { data: created, error: insertError } = await supabase
    .from("tournaments")
    .insert({
      tournament_instance_id: input.tournamentInstanceId,
      name: getSlamDisplayName(input.slamType, input.year, input.gender),
      slam_type: input.slamType,
      year: input.year,
      gender: input.gender,
      status: "picking_open",
      bracket_size: 128,
      picking_deadline: input.pickingDeadline,
      external_provider_id: input.externalProviderId,
      last_synced_at: null
    })
    .select("*")
    .single();
  throwIfError(insertError);
  return { tournament: created, freshlyCreated: true };
}

async function getOrCreateTournamentInstance(
  supabase: SupabaseClient,
  input: { slamType: SlamType; year: number; gender: Gender }
) {
  const { data: existing, error: lookupError } = await supabase
    .from("tournament_instances")
    .select("*")
    .eq("slam_type", input.slamType)
    .eq("year", input.year)
    .eq("gender", input.gender)
    .maybeSingle();
  throwIfError(lookupError);
  if (existing) return existing;

  const calendar = getSlamCalendarDefaults(input.slamType, input.year);
  const { data: created, error: insertError } = await supabase
    .from("tournament_instances")
    .insert({
      name: getSlamDisplayName(input.slamType, input.year, input.gender),
      slam_type: input.slamType,
      year: input.year,
      gender: input.gender,
      status: "draw_pending",
      bracket_size: 128,
      qualifying_starts_at: calendar.qualifyingStartsAt,
      main_draw_starts_at: calendar.mainDrawStartsAt,
      final_starts_at: calendar.finalStartsAt,
      provider_name: "EspnTennisProvider",
      external_provider_id: null,
      last_synced_at: null
    })
    .select("*")
    .single();
  throwIfError(insertError);
  return created;
}

async function getOrCreateDrawSlotsForInstance(supabase: SupabaseClient, tournamentInstanceId: string) {
  const { data: existing, error: lookupError } = await supabase
    .from("draw_slots")
    .select("*")
    .eq("tournament_instance_id", tournamentInstanceId);
  throwIfError(lookupError);

  if ((existing ?? []).length === 128) {
    return new Map<number, any>(existing!.map((slot: any) => [slot.position, slot]));
  }
  if ((existing ?? []).length > 0) {
    throw new Error(`Tournament instance ${tournamentInstanceId} has ${existing!.length} draw slots (expected 0 or 128).`);
  }

  const placeholderPlayers = Array.from({ length: 128 }, (_, index) => ({
    name: `TBD ${index + 1}`,
    country: null,
    seed: null,
    external_provider_id: null
  }));
  const { data: insertedPlayers, error: playerError } = await supabase
    .from("players")
    .insert(placeholderPlayers)
    .select("*");
  throwIfError(playerError);
  if (!insertedPlayers || insertedPlayers.length !== 128) {
    throw new Error(`Could not create 128 placeholder players (got ${insertedPlayers?.length ?? 0}).`);
  }

  const slotPlan = getDefaultDrawSlotPlan();
  const slotsToInsert = slotPlan.map((slot, index) => ({
    tournament_instance_id: tournamentInstanceId,
    position: slot.position,
    side: slot.side,
    section: slot.section,
    seed: null,
    player_id: insertedPlayers[index].id,
    placeholder_label: `TBD ${slot.position}`,
    resolved_at: null,
    external_provider_slot_id: null
  }));
  const { data: insertedSlots, error: slotError } = await supabase
    .from("draw_slots")
    .insert(slotsToInsert)
    .select("*");
  throwIfError(slotError);
  return new Map<number, any>((insertedSlots ?? []).map((slot: any) => [slot.position, slot]));
}

async function insertBracketShellMatchesForTournament(
  supabase: SupabaseClient,
  input: { tournamentId: string; tournamentInstanceId: string; drawSlotsByPosition: Map<number, any> }
) {
  const plan = getDefaultBracketShellMatchPlan();

  // Pre-generate match UUIDs so we can wire next_match_id in a single insert
  // instead of 127 sequential UPDATEs. This is the dominant cost of pool creation.
  const matchIdByKey = new Map<string, string>();
  for (const match of plan) matchIdByKey.set(`${match.roundNumber}:${match.matchNumber}`, createUuid());

  const rowsToInsert = plan.map((match) => {
    const player1Slot = match.player1DrawSlotPosition ? input.drawSlotsByPosition.get(match.player1DrawSlotPosition) : null;
    const player2Slot = match.player2DrawSlotPosition ? input.drawSlotsByPosition.get(match.player2DrawSlotPosition) : null;
    const nextMatchId = match.nextRoundNumber && match.nextMatchNumber
      ? matchIdByKey.get(`${match.nextRoundNumber}:${match.nextMatchNumber}`) ?? null
      : null;
    return {
      id: matchIdByKey.get(`${match.roundNumber}:${match.matchNumber}`),
      tournament_id: input.tournamentId,
      tournament_instance_id: input.tournamentInstanceId,
      round_number: match.roundNumber,
      match_number: match.matchNumber,
      player1_id: player1Slot?.player_id ?? null,
      player2_id: player2Slot?.player_id ?? null,
      player1_draw_slot_id: player1Slot?.id ?? null,
      player2_draw_slot_id: player2Slot?.id ?? null,
      winner_player_id: null,
      winner_draw_slot_id: null,
      status: "scheduled",
      start_time: null,
      score_summary: null,
      external_provider_match_id: null,
      next_match_id: nextMatchId,
      next_match_slot: match.nextMatchSlot
    };
  });

  const { error: insertError } = await supabase.from("matches").insert(rowsToInsert);
  throwIfError(insertError);
}

function getFreshPickingDeadline(templateDeadline?: string | null) {
  const now = new Date();
  const parsedTemplateDeadline = templateDeadline ? new Date(templateDeadline) : null;
  if (parsedTemplateDeadline && parsedTemplateDeadline.getTime() > now.getTime()) return parsedTemplateDeadline.toISOString();

  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  twoDaysFromNow.setMinutes(0, 0, 0);
  return twoDaysFromNow.toISOString();
}

export async function joinPool(input: { inviteCode: string; userId: string }) {
  const supabase = getClient();
  const code = input.inviteCode.trim().toUpperCase();

  const { data: pool, error: poolError } = await supabase.from("pools").select("*").eq("invite_code", code).maybeSingle();
  throwIfError(poolError);
  if (!pool) return null;

  const { data: membership, error: membershipError } = await supabase
    .from("pool_members")
    .upsert(
      {
        pool_id: pool.id,
        user_id: input.userId,
        role: "member"
      },
      { onConflict: "pool_id,user_id" }
    )
    .select("*")
    .single();

  throwIfError(membershipError);
  return { pool: mapPool(pool), membership: mapPoolMember(membership) };
}

export async function joinPoolByEmail(input: { inviteCode: string; email: string; displayName: string }) {
  const supabase = getClient();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const code = input.inviteCode.trim().toUpperCase();

  if (!email || !displayName) throw new Error("Email and display name are required.");

  const { data: pool, error: poolError } = await supabase.from("pools").select("*").eq("invite_code", code).maybeSingle();
  throwIfError(poolError);
  if (!pool) return null;

  const { data: existingProfile, error: profileLookupError } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  throwIfError(profileLookupError);

  let profile = existingProfile;

  if (!profile) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: displayName }
    });
    throwIfError(authError);
    if (!authUser.user) throw new Error("Could not create profile for this email.");

    const { data: insertedProfile, error: insertProfileError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.user.id,
        email,
        display_name: displayName
      })
      .select("*")
      .single();
    throwIfError(insertProfileError);
    profile = insertedProfile;
  } else if (profile.display_name !== displayName) {
    const { data: updatedProfile, error: updateProfileError } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", profile.id)
      .select("*")
      .single();
    throwIfError(updateProfileError);
    profile = updatedProfile;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("pool_members")
    .upsert(
      {
        pool_id: pool.id,
        user_id: profile.id,
        role: pool.commissioner_user_id === profile.id ? "commissioner" : "member"
      },
      { onConflict: "pool_id,user_id" }
    )
    .select("*")
    .single();

  throwIfError(membershipError);

  return {
    pool: mapPool(pool),
    profile: mapProfile(profile),
    membership: mapPoolMember(membership)
  };
}

export async function getBracketBundle(input: { poolId?: string | null; tournamentId?: string | null; userId?: string | null }) {
  const supabase = getClient();
  // Page through brackets (default PostgREST cap is 1000) so a large number of
  // pools sharing a Slam never silently drops some pools' submissions.
  const brackets = await fetchAllRows((from, to) => {
    let query = supabase.from("brackets").select("*");
    if (input.poolId) query = query.eq("pool_id", input.poolId);
    if (input.tournamentId) query = query.eq("tournament_id", input.tournamentId);
    if (input.userId) query = query.eq("user_id", input.userId);
    return query.order("submitted_at", { ascending: false, nullsFirst: false }).range(from, to);
  });

  const bracketIds = brackets.map((row: any) => row.id);
  if (bracketIds.length === 0) return { brackets: [], picks: [] };

  // bracket_picks can exceed PostgREST's 1000-row cap (8+ pools × 127 picks), so page.
  const picks = await fetchAllRows((from, to) =>
    supabase.from("bracket_picks").select("*").in("bracket_id", bracketIds).range(from, to)
  );

  return {
    brackets: brackets.map(mapBracket),
    picks: picks.map(mapBracketPick)
  };
}

export async function saveBracket(input: {
  bracketId?: string;
  poolId: string;
  tournamentId: string;
  userId: string;
  status: BracketStatus;
  submittedAt?: string | null;
  lockedAt?: string | null;
  picks: Array<{ matchId: string; pickedWinnerPlayerId: string }>;
}) {
  const supabase = getClient();
  const bracketId = input.bracketId ?? crypto.randomUUID();

  const { data: bracket, error } = await supabase
    .from("brackets")
    .upsert(
      {
        id: bracketId,
        pool_id: input.poolId,
        tournament_id: input.tournamentId,
        user_id: input.userId,
        submitted_at: input.submittedAt ?? null,
        locked_at: input.lockedAt ?? null,
        status: input.status
      },
      { onConflict: "pool_id,tournament_id,user_id" }
    )
    .select("*")
    .single();

  throwIfError(error);

  if (input.picks.length > 0) {
    const { error: picksError } = await supabase.from("bracket_picks").upsert(
      input.picks.map((pick) => ({
        bracket_id: bracket.id,
        match_id: pick.matchId,
        picked_winner_player_id: pick.pickedWinnerPlayerId
      })),
      { onConflict: "bracket_id,match_id" }
    );
    throwIfError(picksError);
  }

  const { data: existingPicks, error: existingPicksError } = await supabase
    .from("bracket_picks")
    .select("id, match_id")
    .eq("bracket_id", bracket.id);
  throwIfError(existingPicksError);

  const incomingMatchIds = new Set(input.picks.map((pick) => pick.matchId));
  const stalePickIds = (existingPicks ?? [])
    .filter((pick: any) => !incomingMatchIds.has(pick.match_id))
    .map((pick: any) => pick.id);

  if (stalePickIds.length > 0) {
    const { error: deletePicksError } = await supabase.from("bracket_picks").delete().in("id", stalePickIds);
    throwIfError(deletePicksError);
  }

  if (input.status !== "draft") {
    await recalculateTournamentScoresInSupabase(input.tournamentId);
  }

  return getBracketBundle({ poolId: input.poolId, tournamentId: input.tournamentId, userId: input.userId });
}

export async function recordManualMatchUpdate(input: {
  matchId: string;
  tournamentId?: string | null;
  tournamentInstanceId: string;
  createdByUserId: string;
  winnerPlayerId?: string | null;
  scoreSummary?: string | null;
  status?: MatchStatus;
}) {
  const supabase = getClient();
  const status = input.status ?? (input.winnerPlayerId ? "completed" : "scheduled");
  const now = new Date().toISOString();

  // Resolve which draw slot the winning player occupies so we can set
  // winner_draw_slot_id and advance the player exactly like the ESPN sync does.
  const { data: existing, error: existingError } = await supabase
    .from("matches")
    .select("player1_id, player2_id, player1_draw_slot_id, player2_draw_slot_id")
    .eq("id", input.matchId)
    .single();
  throwIfError(existingError);
  if (!existing) throw new Error("Match not found.");

  let winnerDrawSlotId: string | null = null;
  if (input.winnerPlayerId) {
    if (existing.player1_id === input.winnerPlayerId) winnerDrawSlotId = existing.player1_draw_slot_id;
    else if (existing.player2_id === input.winnerPlayerId) winnerDrawSlotId = existing.player2_draw_slot_id;
  }

  const { data: match, error } = await supabase
    .from("matches")
    .update({
      winner_player_id: input.winnerPlayerId ?? null,
      winner_draw_slot_id: winnerDrawSlotId,
      score_summary: input.scoreSummary ?? null,
      status,
      updated_at: now
    })
    .eq("id", input.matchId)
    .select("*")
    .single();

  throwIfError(error);

  // Propagate the result to the next round so a commissioner override behaves
  // like a sync: setting a winner advances them; clearing it retracts the slot.
  if (match.next_match_id && match.next_match_slot) {
    const nextPlayerColumn = match.next_match_slot === "player1" ? "player1_id" : "player2_id";
    const nextDrawSlotColumn = match.next_match_slot === "player1" ? "player1_draw_slot_id" : "player2_draw_slot_id";
    const { error: advanceError } = await supabase
      .from("matches")
      .update({
        [nextPlayerColumn]: input.winnerPlayerId ?? null,
        [nextDrawSlotColumn]: winnerDrawSlotId,
        updated_at: now
      })
      .eq("id", match.next_match_id);
    throwIfError(advanceError);
  }

  const { error: overrideError } = await supabase.from("manual_overrides").insert({
    tournament_instance_id: input.tournamentInstanceId,
    tournament_id: input.tournamentId ?? match.tournament_id,
    match_id: input.matchId,
    override_type: input.winnerPlayerId ? "match_winner" : "match_score",
    locked: true,
    value: {
      winnerPlayerId: input.winnerPlayerId ?? null,
      scoreSummary: input.scoreSummary ?? null,
      status
    },
    created_by_user_id: input.createdByUserId
  });

  throwIfError(overrideError);
  return { match };
}

export async function recordManualPlayerSlotUpdate(input: {
  matchId: string;
  slot: "player1" | "player2";
  name: string;
  country?: string | null;
  tournamentId?: string | null;
  tournamentInstanceId: string;
  createdByUserId: string;
}) {
  const supabase = getClient();
  const playerColumn = input.slot === "player1" ? "player1_id" : "player2_id";
  const drawSlotColumn = input.slot === "player1" ? "player1_draw_slot_id" : "player2_draw_slot_id";

  const { data: match, error: matchError } = await supabase.from("matches").select("*").eq("id", input.matchId).single();
  throwIfError(matchError);

  const playerId = match[playerColumn];
  if (!playerId) throw new Error("This match slot does not have a player yet.");

  const { data: player, error: playerError } = await supabase
    .from("players")
    .update({ name: input.name.trim(), country: input.country?.trim() || null })
    .eq("id", playerId)
    .select("*")
    .single();
  throwIfError(playerError);

  const drawSlotId = match[drawSlotColumn];
  if (drawSlotId) {
    const { error: slotError } = await supabase
      .from("draw_slots")
      .update({ placeholder_label: null, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", drawSlotId);
    throwIfError(slotError);
  }

  const { error: overrideError } = await supabase.from("manual_overrides").insert({
    tournament_instance_id: input.tournamentInstanceId,
    tournament_id: input.tournamentId ?? match.tournament_id,
    match_id: input.matchId,
    draw_slot_id: drawSlotId,
    override_type: "player_slot",
    locked: true,
    value: { slot: input.slot, name: input.name.trim(), country: input.country?.trim() || null },
    created_by_user_id: input.createdByUserId
  });
  throwIfError(overrideError);

  return { match, player: mapPlayer(player) };
}

export async function clearManualOverridesForMatchInSupabase(input: { matchId: string; tournamentId?: string | null }) {
  const supabase = getClient();
  let query = supabase.from("manual_overrides").update({ locked: false }).eq("match_id", input.matchId).eq("locked", true);
  if (input.tournamentId) query = query.eq("tournament_id", input.tournamentId);

  const { data, error } = await query.select("*");
  throwIfError(error);
  return { overridesUnlocked: data?.length ?? 0 };
}

export async function recalculateTournamentScoresInSupabase(tournamentId: string) {
  const supabase = getClient();
  const state = await getAppStateFromSupabase();
  const rescored = recalculateScores(state, tournamentId);
  const bracketIds = rescored.brackets.filter((bracket) => bracket.tournamentId === tournamentId).map((bracket) => bracket.id);

  if (bracketIds.length === 0) return { bracketsScored: 0, picksScored: 0 };

  const picks = rescored.bracketPicks.filter((pick) => bracketIds.includes(pick.bracketId));
  if (picks.length > 0) {
    const { error: picksError } = await supabase.from("bracket_picks").upsert(
      picks.map((pick) => ({
        id: pick.id,
        bracket_id: pick.bracketId,
        match_id: pick.matchId,
        picked_winner_player_id: pick.pickedWinnerPlayerId,
        is_correct: pick.isCorrect,
        points_awarded: pick.pointsAwarded
      })),
      { onConflict: "bracket_id,match_id" }
    );
    throwIfError(picksError);
  }

  const brackets = rescored.brackets.filter((bracket) => bracket.tournamentId === tournamentId);
  const { error: bracketsError } = await supabase.from("brackets").upsert(
    brackets.map((bracket) => ({
      id: bracket.id,
      pool_id: bracket.poolId,
      tournament_id: bracket.tournamentId,
      user_id: bracket.userId,
      submitted_at: bracket.submittedAt,
      locked_at: bracket.lockedAt,
      total_score: bracket.totalScore,
      status: bracket.status
    })),
    { onConflict: "pool_id,tournament_id,user_id" }
  );
  throwIfError(bracketsError);

  return { bracketsScored: brackets.length, picksScored: picks.length };
}

/**
 * Commissioner tool: delete a single user's submission (their bracket, all its
 * picks, and any score events) for a pool's tournament. The user keeps their
 * membership and can re-enter a fresh bracket. FK cascades would cover the
 * children, but we delete explicitly (mirroring the reset path) to be safe.
 */
export async function deleteUserBracketInSupabase(input: { poolId: string; tournamentId: string; userId: string }) {
  const supabase = getClient();
  const { data: bracket, error: lookupError } = await supabase
    .from("brackets")
    .select("id")
    .eq("pool_id", input.poolId)
    .eq("tournament_id", input.tournamentId)
    .eq("user_id", input.userId)
    .maybeSingle();
  throwIfError(lookupError);
  if (!bracket) return { deleted: false as const };

  throwIfError(
    (await supabase.from("score_events").delete().eq("tournament_id", input.tournamentId).eq("user_id", input.userId)).error
  );
  throwIfError((await supabase.from("bracket_picks").delete().eq("bracket_id", bracket.id)).error);
  throwIfError((await supabase.from("brackets").delete().eq("id", bracket.id)).error);

  return { deleted: true as const, bracketId: bracket.id };
}

/**
 * Commissioner tool: remove a member from a pool entirely. Cleans up any bracket
 * they have in the pool first, then the membership. The commissioner can't be
 * removed. Use this to clear "not started" members (including orphaned duplicate
 * profiles) from the roster.
 */
export async function removePoolMemberInSupabase(input: { poolId: string; userId: string }) {
  const supabase = getClient();

  const { data: pool, error: poolError } = await supabase
    .from("pools")
    .select("commissioner_user_id")
    .eq("id", input.poolId)
    .maybeSingle();
  throwIfError(poolError);
  if (!pool) throw new Error("Pool not found.");
  if (pool.commissioner_user_id === input.userId) throw new Error("The commissioner can't be removed from the bracket.");

  const { data: brackets, error: bracketsError } = await supabase
    .from("brackets")
    .select("id, tournament_id")
    .eq("pool_id", input.poolId)
    .eq("user_id", input.userId);
  throwIfError(bracketsError);

  for (const bracket of brackets ?? []) {
    throwIfError(
      (await supabase.from("score_events").delete().eq("tournament_id", bracket.tournament_id).eq("user_id", input.userId)).error
    );
    throwIfError((await supabase.from("bracket_picks").delete().eq("bracket_id", bracket.id)).error);
    throwIfError((await supabase.from("brackets").delete().eq("id", bracket.id)).error);
  }

  throwIfError((await supabase.from("pool_members").delete().eq("pool_id", input.poolId).eq("user_id", input.userId)).error);
  return { removed: true as const };
}

export async function syncEspnLiveUpdatesInSupabase(input: {
  tournamentId: string;
  tournamentInstanceId: string;
  ifStaleMinutes?: number;
}) {
  const supabase = getClient();

  // Bail early if a recent sync already covered us. This is what lets us safely
  // call sync from every page load — first request wins, others no-op cheaply.
  if (typeof input.ifStaleMinutes === "number" && input.ifStaleMinutes > 0) {
    const { data: instance, error: instanceLookupError } = await supabase
      .from("tournament_instances")
      .select("last_synced_at")
      .eq("id", input.tournamentInstanceId)
      .maybeSingle();
    throwIfError(instanceLookupError);
    const lastSyncedAt = instance?.last_synced_at ? new Date(instance.last_synced_at).getTime() : 0;
    const ageMinutes = (Date.now() - lastSyncedAt) / 60_000;
    if (ageMinutes < input.ifStaleMinutes) {
      return { skipped: true as const, reason: "fresh", lastSyncedAt: instance?.last_synced_at ?? null, ageMinutes };
    }
  }

  const state = await getAppStateFromSupabase();
  const tournament = state.tournaments.find((item) => item.id === input.tournamentId);
  if (!tournament) throw new Error("Tournament not found.");

  const provider = new EspnTennisProvider();
  const [drawLinks, providerMatches] = await Promise.all([
    provider.getDrawMatchLinks({
      slamType: tournament.slamType,
      year: tournament.year,
      gender: tournament.gender
    }),
    provider.getPreviewMatches({
      slamType: tournament.slamType,
      year: tournament.year
    })
  ]);

  const rawSnapshotId = await recordLiveScoreSnapshot({
    tournamentId: input.tournamentId,
    providerName: "EspnTennisProvider",
    rawPayload: {
      drawLinks: drawLinks.rawPayload,
      matchUpdates: providerMatches.map((match) => ({
        providerMatchId: normalizeEspnMatchId(match.providerMatchId),
        providerEventId: match.providerEventId ?? null,
        eventType: match.eventType,
        status: match.status,
        roundName: match.roundName ?? null,
        player1Name: match.player1Name ?? null,
        player1ProviderId: match.player1ProviderId ?? null,
        player2Name: match.player2Name ?? null,
        player2ProviderId: match.player2ProviderId ?? null,
        scoreSummary: match.scoreSummary ?? null,
        winnerName: match.winnerName ?? null,
        winnerProviderId: match.winnerProviderId ?? null
      }))
    }
  });

  const matchesByRoundAndNumber = new Map(
    state.matches
      .filter((match) => match.tournamentId === input.tournamentId)
      .map((match) => [`${match.roundNumber}:${match.matchNumber}`, match])
  );
  let matchLinksUpdated = 0;
  const now = new Date().toISOString();

  for (const link of drawLinks.links) {
    const match = matchesByRoundAndNumber.get(`${link.roundNumber}:${link.matchNumber}`);
    if (!match) continue;
    const providerMatchId = normalizeEspnMatchId(link.providerMatchId);
    if (match.externalProviderMatchId === providerMatchId && (match.startTime ?? null) === (link.startTime ?? null)) continue;
    const { error } = await supabase
      .from("matches")
      .update({
        external_provider_match_id: providerMatchId,
        start_time: link.startTime ?? match.startTime ?? null,
        updated_at: now
      })
      .eq("id", match.id);
    throwIfError(error);
    match.externalProviderMatchId = providerMatchId;
    match.startTime = link.startTime ?? match.startTime ?? null;
    matchLinksUpdated += 1;
  }

  const eventType = tournament.gender === "women" ? "womens_singles" : "mens_singles";
  const providerMatchById = new Map(
    providerMatches
      .filter((match) => match.eventType === eventType)
      .map((match) => [normalizeEspnMatchId(match.providerMatchId), match])
  );
  const playerByProviderId = new Map(
    state.players
      .filter((player) => player.externalProviderId)
      .map((player) => [normalizeEspnPlayerId(player.externalProviderId ?? ""), player.id])
  );
  const lockedMatchIds = await getLockedManualMatchIds(input.tournamentId);
  let matchesUpdated = 0;
  let winnersApplied = 0;
  let matchesAdvanced = 0;
  let skippedManualOverrides = 0;
  let needsReview = 0;

  for (const match of state.matches.filter((item) => item.tournamentId === input.tournamentId)) {
    const providerMatch = providerMatchById.get(normalizeEspnMatchId(match.externalProviderMatchId ?? ""));
    if (!providerMatch) continue;
    if (lockedMatchIds.has(match.id)) {
      skippedManualOverrides += 1;
      continue;
    }

    const result = getSafeEspnMatchUpdate(match, providerMatch, playerByProviderId);
    if (result.needsReview) {
      needsReview += 1;
      continue;
    }

    const { error } = await supabase
      .from("matches")
      .update({
        status: result.status,
        score_summary: result.scoreSummary,
        winner_player_id: result.winnerPlayerId,
        winner_draw_slot_id: result.winnerDrawSlotId,
        updated_at: now
      })
      .eq("id", match.id);
    throwIfError(error);
    matchesUpdated += 1;
    if (result.winnerPlayerId && result.status === "completed") winnersApplied += 1;

    if (result.winnerPlayerId && match.nextMatchId && match.nextMatchSlot) {
      const nextPlayerColumn = match.nextMatchSlot === "player1" ? "player1_id" : "player2_id";
      const nextDrawSlotColumn = match.nextMatchSlot === "player1" ? "player1_draw_slot_id" : "player2_draw_slot_id";
      const { error: advanceError } = await supabase
        .from("matches")
        .update({
          [nextPlayerColumn]: result.winnerPlayerId,
          [nextDrawSlotColumn]: result.winnerDrawSlotId,
          updated_at: now
        })
        .eq("id", match.nextMatchId);
      throwIfError(advanceError);
      matchesAdvanced += 1;
    }
  }

  // Picking is commissioner-controlled (Admin lock/unlock). The results sync
  // must not silently re-lock it: if picking is intentionally open, leave it
  // open even as live results arrive. Otherwise advance to in_progress once
  // results start flowing.
  const tournamentStatus: TournamentStatus =
    tournament.status === "picking_open"
      ? "picking_open"
      : winnersApplied > 0 || matchesUpdated > 0
        ? "in_progress"
        : tournament.status;
  throwIfError((await supabase.from("tournaments").update({
    status: tournamentStatus,
    last_synced_at: now
  }).eq("id", input.tournamentId)).error);
  throwIfError((await supabase.from("tournament_instances").update({
    status: tournamentStatus === "completed" ? "completed" : "in_progress",
    last_synced_at: now
  }).eq("id", input.tournamentInstanceId)).error);

  const syncRun = await recordProviderSyncRun({
    tournamentInstanceId: input.tournamentInstanceId,
    tournamentId: input.tournamentId,
    providerName: "EspnTennisProvider",
    syncType: "match_updates",
    status: "success",
    rawSnapshotId
  });
  const scoring = await recalculateTournamentScoresInSupabase(input.tournamentId);

  return {
    syncRun,
    rawSnapshotId,
    matchLinksUpdated,
    matchesUpdated,
    winnersApplied,
    matchesAdvanced,
    skippedManualOverrides,
    needsReview,
    scoring
  };
}

async function getLockedManualMatchIds(tournamentId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("manual_overrides")
    .select("match_id")
    .eq("tournament_id", tournamentId)
    .eq("locked", true)
    .in("override_type", ["match_winner", "match_score", "player_slot"]);
  throwIfError(error);
  return new Set((data ?? []).map((override: any) => override.match_id).filter(Boolean));
}

function getSafeEspnMatchUpdate(match: Match, providerMatch: ProviderMatch, playerByProviderId: Map<string, string>) {
  const status = mapEspnStatusToInternal(providerMatch.status);
  const winnerPlayerId = providerMatch.winnerProviderId
    ? playerByProviderId.get(normalizeEspnPlayerId(providerMatch.winnerProviderId)) ?? null
    : null;
  const hasFinalStatus = providerMatch.status === "completed" || providerMatch.status === "retired" || providerMatch.status === "walkover";
  if (hasFinalStatus && !winnerPlayerId) {
    return { needsReview: true };
  }

  const winnerDrawSlotId = winnerPlayerId === match.player1Id
    ? match.player1DrawSlotId ?? null
    : winnerPlayerId === match.player2Id
      ? match.player2DrawSlotId ?? null
      : null;

  if (hasFinalStatus && winnerPlayerId && winnerPlayerId !== match.player1Id && winnerPlayerId !== match.player2Id) {
    return { needsReview: true };
  }

  return {
    needsReview: false,
    status,
    scoreSummary: providerMatch.scoreSummary ?? match.scoreSummary ?? null,
    winnerPlayerId: hasFinalStatus ? winnerPlayerId : match.winnerPlayerId ?? null,
    winnerDrawSlotId: hasFinalStatus ? winnerDrawSlotId : match.winnerDrawSlotId ?? null
  };
}

function mapEspnStatusToInternal(status: ProviderMatch["status"]): MatchStatus {
  if (status === "live") return "live";
  if (status === "completed" || status === "retired" || status === "walkover") return "completed";
  return "scheduled";
}

function normalizeEspnMatchId(matchId: string) {
  if (!matchId) return "";
  return matchId.startsWith("espn-match-") ? matchId : `espn-match-${matchId}`;
}

function normalizeEspnPlayerId(playerId: string) {
  if (!playerId) return "";
  return playerId.startsWith("espn-player-") ? playerId : `espn-player-${playerId}`;
}

function providerIdsMatch(localId?: string | null, providerId?: string | null) {
  if (!localId || !providerId) return false;
  return normalizeProviderId(localId) === normalizeProviderId(providerId);
}

function normalizeProviderId(value: string) {
  return value.toLowerCase().replace(/^mock-/, "").replace(/^match[_-]/, "").replace(/[^a-z0-9]/g, "");
}

export async function recordProviderSyncRun(input: {
  tournamentInstanceId: string;
  tournamentId?: string | null;
  providerName: string;
  syncType: "calendar" | "draw" | "match_updates" | "manual";
  status: "success" | "failed" | "running";
  errorMessage?: string | null;
  rawSnapshotId?: string | null;
}) {
  const supabase = getClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("provider_sync_runs")
    .insert({
      tournament_instance_id: input.tournamentInstanceId,
      tournament_id: input.tournamentId ?? null,
      provider_name: input.providerName,
      sync_type: input.syncType,
      status: input.status,
      started_at: now,
      finished_at: input.status === "running" ? null : now,
      error_message: input.errorMessage ?? null,
      raw_snapshot_id: input.rawSnapshotId ?? null
    })
    .select("*")
    .single();

  throwIfError(error);
  return data;
}

export async function recordLiveScoreSnapshot(input: {
  tournamentId: string;
  providerName: string;
  rawPayload: unknown;
}) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("live_score_snapshots")
    .insert({
      tournament_id: input.tournamentId,
      provider_name: input.providerName,
      raw_payload: input.rawPayload
    })
    .select("id")
    .single();

  throwIfError(error);
  return data?.id as string | undefined;
}

export async function importEspnDrawInSupabase(input: { tournamentId: string; draw: EspnDrawImportData; resetExistingPicks?: boolean }) {
  const supabase = getClient();

  // Targeted queries instead of loading every table via getAppStateFromSupabase().
  const [tournamentResult, bracketsResult] = await Promise.all([
    supabase.from("tournaments").select("id, tournament_instance_id").eq("id", input.tournamentId).maybeSingle(),
    supabase.from("brackets").select("id").eq("tournament_id", input.tournamentId)
  ]);
  throwIfError(tournamentResult.error);
  throwIfError(bracketsResult.error);
  const tournament = tournamentResult.data;
  if (!tournament?.tournament_instance_id) throw new Error("Tournament not found.");

  const bracketIds = new Set<string>((bracketsResult.data ?? []).map((row: any) => row.id));
  let pickCount = 0;
  if (bracketIds.size > 0) {
    const { count, error } = await supabase
      .from("bracket_picks")
      .select("id", { count: "exact", head: true })
      .in("bracket_id", Array.from(bracketIds));
    throwIfError(error);
    pickCount = count ?? 0;
  }
  if (pickCount > 0 && !input.resetExistingPicks) {
    throw new Error("Cannot import a real ESPN draw after bracket picks exist. Create a fresh bracket or clear picks first.");
  }

  if (input.resetExistingPicks && bracketIds.size > 0) {
    throwIfError((await supabase.from("score_events").delete().eq("tournament_id", input.tournamentId)).error);
    throwIfError((await supabase.from("bracket_picks").delete().in("bracket_id", Array.from(bracketIds))).error);
    throwIfError((await supabase.from("brackets").delete().in("id", Array.from(bracketIds))).error);
  }

  if (input.draw.matchups.length !== 64) {
    throw new Error(`ESPN draw has ${input.draw.matchups.length} first-round matchups; expected 64.`);
  }

  const [drawSlotsResult, matchesResult] = await Promise.all([
    supabase
      .from("draw_slots")
      .select("id, position, player_id")
      .eq("tournament_instance_id", tournament.tournament_instance_id),
    supabase
      .from("matches")
      .select("id, round_number, match_number")
      .eq("tournament_id", input.tournamentId)
  ]);
  throwIfError(drawSlotsResult.error);
  throwIfError(matchesResult.error);

  const drawSlotsByPosition = new Map<number, { id: string; position: number; playerId: string }>(
    (drawSlotsResult.data ?? []).map((row: any) => [row.position, { id: row.id, position: row.position, playerId: row.player_id }])
  );
  const matchesByRoundAndNumber = new Map<string, { id: string; roundNumber: number; matchNumber: number }>(
    (matchesResult.data ?? []).map((row: any) => [`${row.round_number}:${row.match_number}`, { id: row.id, roundNumber: row.round_number, matchNumber: row.match_number }])
  );

  const now = new Date().toISOString();

  // Collect every update so we can fire them in parallel rather than ~320 sequential
  // round-trips. Pre-validate everything before any writes so we fail cleanly.
  const playerUpdates: any[] = [];
  const slotUpdates: any[] = [];
  const matchUpdates: any[] = [];

  for (const matchup of input.draw.matchups) {
    for (const slot of [matchup.player1, matchup.player2]) {
      const drawSlot = drawSlotsByPosition.get(slot.position);
      if (!drawSlot) throw new Error(`Missing internal draw slot ${slot.position}.`);

      playerUpdates.push(
        supabase
          .from("players")
          .update({
            external_provider_id: slot.playerProviderId,
            name: slot.playerName,
            country: slot.country ?? null,
            seed: slot.seed ?? null
          })
          .eq("id", drawSlot.playerId)
      );

      slotUpdates.push(
        supabase
          .from("draw_slots")
          .update({
            seed: slot.seed ?? null,
            placeholder_label: null,
            resolved_at: now,
            external_provider_slot_id: `espn-slot-${slot.position}`,
            updated_at: now
          })
          .eq("id", drawSlot.id)
      );
    }

    const match = matchesByRoundAndNumber.get(`1:${matchup.matchNumber}`);
    const player1Slot = drawSlotsByPosition.get(matchup.player1.position);
    const player2Slot = drawSlotsByPosition.get(matchup.player2.position);
    if (!match || !player1Slot || !player2Slot) throw new Error(`Could not map first-round match ${matchup.matchNumber}.`);

    matchUpdates.push(
      supabase
        .from("matches")
        .update({
          player1_id: player1Slot.playerId,
          player2_id: player2Slot.playerId,
          player1_draw_slot_id: player1Slot.id,
          player2_draw_slot_id: player2Slot.id,
          winner_player_id: null,
          winner_draw_slot_id: null,
          status: "scheduled",
          start_time: matchup.startTime ?? null,
          score_summary: null,
          external_provider_match_id: matchup.providerMatchId,
          updated_at: now
        })
        .eq("id", match.id)
    );
  }

  const allResults = await Promise.all([...playerUpdates, ...slotUpdates, ...matchUpdates]);
  for (const result of allResults) throwIfError(result.error);

  const downstreamMatchIds = (matchesResult.data ?? [])
    .filter((row: any) => row.round_number > 1)
    .map((row: any) => row.id);
  if (downstreamMatchIds.length > 0) {
    const { error: downstreamError } = await supabase
      .from("matches")
      .update({
        player1_id: null,
        player2_id: null,
        winner_player_id: null,
        winner_draw_slot_id: null,
        status: "scheduled",
        score_summary: null,
        external_provider_match_id: null,
        updated_at: now
      })
      .in("id", downstreamMatchIds);
    throwIfError(downstreamError);
  }

  throwIfError((await supabase.from("tournaments").update({
    external_provider_id: `espn:${input.draw.tournamentId}:${input.draw.eventType}`,
    last_synced_at: now
  }).eq("id", input.tournamentId)).error);

  throwIfError((await supabase.from("tournament_instances").update({
    provider_name: input.draw.providerName,
    external_provider_id: `espn:${input.draw.tournamentId}:${input.draw.eventType}`,
    status: "draw_ready",
    last_synced_at: now
  }).eq("id", tournament.tournament_instance_id)).error);

  const rawSnapshotId = await recordLiveScoreSnapshot({
    tournamentId: input.tournamentId,
    providerName: input.draw.providerName,
    rawPayload: input.draw.rawPayload
  });

  const syncRun = await recordProviderSyncRun({
    tournamentInstanceId: tournament.tournament_instance_id,
    tournamentId: input.tournamentId,
    providerName: input.draw.providerName,
    syncType: "draw",
    status: "success",
    rawSnapshotId
  });

  return {
    matchupsImported: input.draw.matchups.length,
    playersUpdated: input.draw.matchups.length * 2,
    bracketsReset: input.resetExistingPicks ? bracketIds.size : 0,
    picksReset: input.resetExistingPicks ? pickCount : 0,
    rawSnapshotId,
    syncRun
  };
}
