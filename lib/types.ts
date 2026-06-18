export type SlamType = "australian_open" | "french_open" | "wimbledon" | "us_open";
export type Gender = "men" | "women";
export type TournamentStatus = "setup" | "picking_open" | "locked" | "in_progress" | "completed";
export type PoolRole = "commissioner" | "member";
export type MatchStatus = "scheduled" | "live" | "completed";
export type ProviderMatchStatus = "scheduled" | "live" | "completed" | "retired" | "walkover" | "cancelled" | "needs_review";
export type ProviderEventType = "mens_singles" | "womens_singles";
export type NextMatchSlot = "player1" | "player2";
export type BracketStatus = "draft" | "submitted" | "locked";
export type TournamentInstanceStatus = "scheduled" | "draw_pending" | "draw_partial" | "draw_ready" | "in_progress" | "completed";
export type ProviderSyncStatus = "success" | "failed" | "running";
export type ManualOverrideType = "match_winner" | "match_score" | "player_slot";

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface Pool {
  id: string;
  name: string;
  commissionerUserId: string;
  inviteCode: string;
  createdAt: string;
}

export interface PoolMember {
  id: string;
  poolId: string;
  userId: string;
  role: PoolRole;
  joinedAt: string;
}

export interface Tournament {
  id: string;
  tournamentInstanceId?: string | null;
  name: string;
  slamType: SlamType;
  year: number;
  gender: Gender;
  status: TournamentStatus;
  bracketSize: number;
  pickingDeadline: string;
  createdAt: string;
  externalProviderId?: string | null;
  lastSyncedAt?: string | null;
  // Set the first time the whole draw is decided. Drives the dashboard's
  // Active vs. History split. Never cleared once set.
  completedAt?: string | null;
}

export interface TournamentRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  roundName: string;
  pointsPerCorrectPick: number;
}

export interface Player {
  id: string;
  externalProviderId?: string | null;
  name: string;
  country?: string | null;
  seed?: number | null;
}

export interface Match {
  id: string;
  tournamentId: string;
  tournamentInstanceId?: string | null;
  roundNumber: number;
  matchNumber: number;
  player1DrawSlotId?: string | null;
  player2DrawSlotId?: string | null;
  winnerDrawSlotId?: string | null;
  player1Id?: string | null;
  player2Id?: string | null;
  winnerPlayerId?: string | null;
  status: MatchStatus;
  startTime?: string | null;
  scoreSummary?: string | null;
  externalProviderMatchId?: string | null;
  nextMatchId?: string | null;
  nextMatchSlot?: NextMatchSlot | null;
  updatedAt: string;
}

export interface Bracket {
  id: string;
  poolId: string;
  tournamentId: string;
  userId: string;
  submittedAt?: string | null;
  lockedAt?: string | null;
  totalScore: number;
  status: BracketStatus;
}

export interface BracketPick {
  id: string;
  bracketId: string;
  matchId: string;
  pickedWinnerPlayerId: string;
  isCorrect?: boolean | null;
  pointsAwarded: number;
}

export interface ScoreEvent {
  id: string;
  tournamentId: string;
  matchId: string;
  userId: string;
  bracketPickId: string;
  pointsAwarded: number;
  reason: string;
  createdAt: string;
}

export interface LiveScoreSnapshot {
  id: string;
  tournamentId: string;
  providerName: string;
  rawPayload: unknown;
  createdAt: string;
}

export interface TennisDataProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface TournamentInstance {
  id: string;
  name: string;
  slamType: SlamType;
  year: number;
  gender: Gender;
  status: TournamentInstanceStatus;
  bracketSize: number;
  qualifyingStartsAt: string;
  mainDrawStartsAt: string;
  finalStartsAt: string;
  providerName: string;
  externalProviderId?: string | null;
  lastSyncedAt?: string | null;
  createdAt: string;
}

export interface PoolTournament {
  id: string;
  poolId: string;
  tournamentId: string;
  tournamentInstanceId: string;
  pickingDeadline: string;
  lockedAt?: string | null;
  commissionerNotes?: string | null;
  createdAt: string;
}

export interface DrawSlot {
  id: string;
  tournamentInstanceId: string;
  position: number;
  side: "top" | "bottom";
  section: number;
  seed?: number | null;
  playerId: string;
  placeholderLabel?: string | null;
  resolvedAt?: string | null;
  externalProviderSlotId?: string | null;
  updatedAt: string;
}

export interface ProviderSyncRun {
  id: string;
  tournamentInstanceId: string;
  tournamentId?: string | null;
  providerName: string;
  syncType: "calendar" | "draw" | "match_updates" | "manual";
  status: ProviderSyncStatus;
  startedAt: string;
  finishedAt?: string | null;
  errorMessage?: string | null;
  rawSnapshotId?: string | null;
}

export interface ManualOverride {
  id: string;
  tournamentInstanceId: string;
  tournamentId?: string | null;
  matchId?: string | null;
  drawSlotId?: string | null;
  overrideType: ManualOverrideType;
  locked: boolean;
  value: Record<string, unknown>;
  createdByUserId: string;
  createdAt: string;
}

export interface AppState {
  profiles: Profile[];
  pools: Pool[];
  poolMembers: PoolMember[];
  tournaments: Tournament[];
  rounds: TournamentRound[];
  players: Player[];
  matches: Match[];
  brackets: Bracket[];
  bracketPicks: BracketPick[];
  scoreEvents: ScoreEvent[];
  liveScoreSnapshots: LiveScoreSnapshot[];
  tennisDataProviders: TennisDataProviderConfig[];
  tournamentInstances: TournamentInstance[];
  poolTournaments: PoolTournament[];
  drawSlots: DrawSlot[];
  providerSyncRuns: ProviderSyncRun[];
  manualOverrides: ManualOverride[];
}

export interface DrawData {
  tournament?: Tournament;
  tournamentInstance?: TournamentInstance;
  rounds: TournamentRound[];
  players: Player[];
  matches: Match[];
  drawSlots?: DrawSlot[];
}

export interface LiveMatchData {
  externalProviderMatchId: string;
  status: MatchStatus;
  scoreSummary?: string | null;
}

export interface CompletedMatchData extends LiveMatchData {
  winnerExternalProviderId: string;
}

export interface ProviderLineScore {
  value: number | null;
  displayValue: string;
  tiebreak?: number | null;
  winner?: boolean | null;
}

export interface ProviderMatch {
  providerMatchId: string;
  providerEventId?: string | null;
  tournamentName?: string | null;
  tournamentId?: string | null;
  roundName?: string | null;
  eventType: ProviderEventType;
  status: ProviderMatchStatus;
  startTime?: string | null;
  player1Name?: string | null;
  player1ProviderId?: string | null;
  player2Name?: string | null;
  player2ProviderId?: string | null;
  player1Linescores: ProviderLineScore[];
  player2Linescores: ProviderLineScore[];
  scoreSummary?: string | null;
  winnerName?: string | null;
  winnerProviderId?: string | null;
  rawPayload: unknown;
}

export interface BracketLiveScore {
  matchId: string;
  externalProviderMatchId: string;
  status: ProviderMatchStatus;
  scoreSummary?: string | null;
  player1Linescores: ProviderLineScore[];
  player2Linescores: ProviderLineScore[];
  checkedAt: string;
}

export interface UpcomingGrandSlam {
  slamType: SlamType;
  year: number;
  gender: Gender;
  name: string;
  qualifyingStartsAt: string;
  mainDrawStartsAt: string;
  finalStartsAt: string;
  status: TournamentInstanceStatus;
  externalProviderId: string;
}

export interface ProviderHealth {
  providerName: string;
  ok: boolean;
  mode: "mock" | "free_api" | "paid_api";
  message: string;
  checkedAt: string;
}
