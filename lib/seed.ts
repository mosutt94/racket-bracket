import type { AppState, DrawSlot, Match, Player, Pool, PoolMember, Profile, Tournament, TournamentInstance, TournamentRound } from "@/lib/types";

const now = new Date("2026-05-24T12:00:00-04:00").toISOString();
const deadline = new Date("2026-05-25T10:00:00-04:00").toISOString();

export const demoUser: Profile = {
  id: "user_demo",
  email: "demo@racketbracket.app",
  displayName: "Demo Captain",
  createdAt: now
};

const pool: Pool = {
  id: "pool_roland_friends",
  name: "Roland Friends 2026",
  commissionerUserId: demoUser.id,
  inviteCode: "CLAY26",
  createdAt: now
};

const members: PoolMember[] = [
  { id: "member_demo", poolId: pool.id, userId: demoUser.id, role: "commissioner", joinedAt: now },
  { id: "member_sam", poolId: pool.id, userId: "user_sam", role: "member", joinedAt: now },
  { id: "member_nora", poolId: pool.id, userId: "user_nora", role: "member", joinedAt: now }
];

const profiles: Profile[] = [
  demoUser,
  { id: "user_sam", email: "sam@example.com", displayName: "Sam Slice", createdAt: now },
  { id: "user_nora", email: "nora@example.com", displayName: "Nora Netcord", createdAt: now }
];

const tournament: Tournament = {
  id: "tournament_french_2026_men",
  tournamentInstanceId: "instance_french_2026_men",
  name: "French Open 2026 Men's Singles",
  slamType: "french_open",
  year: 2026,
  gender: "men",
  status: "picking_open",
  bracketSize: 128,
  pickingDeadline: deadline,
  createdAt: now,
  externalProviderId: "mock-roland-garros-2026-men",
  lastSyncedAt: null
};

const tournamentInstance: TournamentInstance = {
  id: "instance_french_2026_men",
  name: "French Open 2026 Men's Singles",
  slamType: "french_open",
  year: 2026,
  gender: "men",
  status: "draw_partial",
  bracketSize: 128,
  qualifyingStartsAt: new Date("2026-05-18T10:00:00-04:00").toISOString(),
  mainDrawStartsAt: new Date("2026-05-24T10:00:00-04:00").toISOString(),
  finalStartsAt: new Date("2026-06-07T09:00:00-04:00").toISOString(),
  providerName: "MockTennisDataProvider",
  externalProviderId: "mock-roland-garros-2026-men",
  lastSyncedAt: null,
  createdAt: now
};

const rounds: TournamentRound[] = [
  { id: "round_1", tournamentId: tournament.id, roundNumber: 1, roundName: "Round of 128", pointsPerCorrectPick: 1 },
  { id: "round_2", tournamentId: tournament.id, roundNumber: 2, roundName: "Round of 64", pointsPerCorrectPick: 2 },
  { id: "round_3", tournamentId: tournament.id, roundNumber: 3, roundName: "Round of 32", pointsPerCorrectPick: 4 },
  { id: "round_4", tournamentId: tournament.id, roundNumber: 4, roundName: "Round of 16", pointsPerCorrectPick: 8 },
  { id: "round_5", tournamentId: tournament.id, roundNumber: 5, roundName: "Quarterfinal", pointsPerCorrectPick: 16 },
  { id: "round_6", tournamentId: tournament.id, roundNumber: 6, roundName: "Semifinal", pointsPerCorrectPick: 32 },
  { id: "round_7", tournamentId: tournament.id, roundNumber: 7, roundName: "Final", pointsPerCorrectPick: 64 }
];

const firstNames = [
  "Luca", "Mateo", "Jonas", "Emil", "Theo", "Nikolai", "Rafael", "Oscar", "Marco", "Kenji", "Felix", "Diego",
  "Andre", "Caleb", "Hugo", "Tomas", "Noah", "Ilya", "Sebastian", "Julian", "Arthur", "Dante", "Milan", "Elias",
  "Victor", "Adrian", "Leo", "Maxime", "Pavel", "Nico", "Soren", "Gabriel"
];
const lastNames = [
  "Moreau", "Silva", "Reed", "Hartmann", "Laurent", "Petrov", "Costa", "Finch", "Bellini", "Sato", "Berg", "Arroyo",
  "Novak", "Brooks", "Dubois", "Varga", "Kovac", "Mendoza", "Fischer", "Rossi", "Tanaka", "Bennett", "Muller", "Garcia",
  "Anders", "Santos", "Ito", "Hughes", "Popov", "Klein", "Roux", "Marin"
];
const countries = ["FRA", "ESP", "USA", "GER", "ITA", "BRA", "JPN", "GBR", "ARG", "AUS", "CZE", "SWE", "BEL", "CRO", "BUL", "CAN"];

const players: Player[] = Array.from({ length: 128 }, (_, index) => {
  const playerNumber = index + 1;
  const isQualifierPlaceholder = playerNumber > 112;
  return {
    id: `player_${playerNumber}`,
    externalProviderId: `mock-player_${playerNumber}`,
    name: isQualifierPlaceholder
      ? `Qualifier / Lucky Loser ${playerNumber - 112}`
      : `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`,
    country: isQualifierPlaceholder ? null : countries[index % countries.length],
    seed: playerNumber <= 32 ? playerNumber : null
  };
});

const drawSlots: DrawSlot[] = players.map((player, index) => {
  const position = index + 1;
  const isPlaceholder = player.name.startsWith("Qualifier / Lucky Loser");
  return {
    id: `slot_${position}`,
    tournamentInstanceId: tournamentInstance.id,
    position,
    side: position <= 64 ? "top" : "bottom",
    section: Math.ceil(position / 16),
    seed: player.seed,
    playerId: player.id,
    placeholderLabel: isPlaceholder ? player.name : null,
    resolvedAt: isPlaceholder ? null : now,
    externalProviderSlotId: `mock-slot-${position}`,
    updatedAt: now
  };
});

const match = (
  id: string,
  roundNumber: number,
  matchNumber: number,
  player1Id: string | null,
  player2Id: string | null,
  nextMatchId: string | null,
  nextMatchSlot: "player1" | "player2" | null
): Match => ({
  id,
  tournamentId: tournament.id,
  tournamentInstanceId: tournamentInstance.id,
  roundNumber,
  matchNumber,
  player1DrawSlotId: player1Id ? `slot_${Number(player1Id.replace("player_", ""))}` : null,
  player2DrawSlotId: player2Id ? `slot_${Number(player2Id.replace("player_", ""))}` : null,
  winnerDrawSlotId: null,
  player1Id,
  player2Id,
  winnerPlayerId: null,
  status: "scheduled",
  startTime: null,
  scoreSummary: null,
  externalProviderMatchId: `mock-${id}`,
  nextMatchId,
  nextMatchSlot,
  updatedAt: now
});

const roundSlugs: Record<number, string> = {
  1: "r128",
  2: "r64",
  3: "r32",
  4: "r16",
  5: "qf",
  6: "sf",
  7: "final"
};

const matches: Match[] = Array.from({ length: 7 }).flatMap((_, roundIndex) => {
  const roundNumber = roundIndex + 1;
  const matchesInRound = 64 / Math.pow(2, roundIndex);

  return Array.from({ length: matchesInRound }, (__, matchIndex) => {
    const matchNumber = matchIndex + 1;
    const id = `match_${roundSlugs[roundNumber]}_${matchNumber}`;
    const nextRoundNumber = roundNumber + 1;
    const nextMatchNumber = Math.ceil(matchNumber / 2);
    const nextMatchId = roundNumber < 7 ? `match_${roundSlugs[nextRoundNumber]}_${nextMatchNumber}` : null;
    const nextMatchSlot = roundNumber < 7 ? (matchNumber % 2 === 1 ? "player1" : "player2") : null;
    const player1Id = roundNumber === 1 ? `player_${matchIndex * 2 + 1}` : null;
    const player2Id = roundNumber === 1 ? `player_${matchIndex * 2 + 2}` : null;

    return match(id, roundNumber, matchNumber, player1Id, player2Id, nextMatchId, nextMatchSlot);
  });
});

export const initialState: AppState = {
  profiles,
  pools: [pool],
  poolMembers: members,
  tournaments: [tournament],
  rounds,
  players,
  matches,
  brackets: [],
  bracketPicks: [],
  scoreEvents: [],
  liveScoreSnapshots: [],
  tournamentInstances: [tournamentInstance],
  poolTournaments: [
    {
      id: "pool_tournament_roland_friends_2026_men",
      poolId: pool.id,
      tournamentId: tournament.id,
      tournamentInstanceId: tournamentInstance.id,
      pickingDeadline: tournamentInstance.mainDrawStartsAt,
      lockedAt: null,
      commissionerNotes: "Mock staged Grand Slam lifecycle with qualifier placeholders.",
      createdAt: now
    }
  ],
  drawSlots,
  providerSyncRuns: [],
  manualOverrides: [],
  tennisDataProviders: [
    {
      id: "provider_mock",
      name: "MockTennisDataProvider",
      enabled: true,
      config: { mode: "deterministic-demo" },
      createdAt: now
    }
  ]
};
