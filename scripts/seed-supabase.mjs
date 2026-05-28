import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const now = new Date("2026-05-24T16:00:00.000Z").toISOString();
const deadline = new Date("2026-05-24T14:00:00.000Z").toISOString();
const demoPassword = "RacketBracket2026!";

function uuid(seed) {
  const hex = createHash("sha1").update(`racket-bracket:${seed}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function upsert(table, rows, options = {}) {
  const { error } = await supabase.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function update(table, values, column, value) {
  const { error } = await supabase.from(table).update(values).eq(column, value);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function getOrCreateUser(email, displayName) {
  const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  const existing = listed.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: demoPassword,
    email_confirm: true,
    user_metadata: { display_name: displayName }
  });
  if (error) throw error;
  return data.user;
}

const demoUser = await getOrCreateUser("demo@racketbracket.app", "Demo Captain");
const samUser = await getOrCreateUser("sam@example.com", "Sam Slice");
const noraUser = await getOrCreateUser("nora@example.com", "Nora Netcord");

await upsert("profiles", [
  { id: demoUser.id, email: "demo@racketbracket.app", display_name: "Demo Captain", created_at: now },
  { id: samUser.id, email: "sam@example.com", display_name: "Sam Slice", created_at: now },
  { id: noraUser.id, email: "nora@example.com", display_name: "Nora Netcord", created_at: now }
], { onConflict: "id" });

const poolId = uuid("pool:roland-friends");
const tournamentInstanceId = uuid("instance:french-open-2026-men");
const tournamentId = uuid("tournament:french-open-2026-men");

await upsert("tennis_data_providers", [
  {
    id: uuid("provider:mock"),
    name: "MockTennisDataProvider",
    enabled: true,
    config: { mode: "deterministic-demo" },
    created_at: now
  }
], { onConflict: "name" });

await upsert("tournament_instances", [
  {
    id: tournamentInstanceId,
    name: "French Open 2026 Men's Singles",
    slam_type: "french_open",
    year: 2026,
    gender: "men",
    status: "draw_partial",
    bracket_size: 128,
    qualifying_starts_at: "2026-05-18T14:00:00.000Z",
    main_draw_starts_at: "2026-05-24T14:00:00.000Z",
    final_starts_at: "2026-06-07T13:00:00.000Z",
    provider_name: "MockTennisDataProvider",
    external_provider_id: "mock-roland-garros-2026-men",
    last_synced_at: null,
    created_at: now
  }
], { onConflict: "slam_type,year,gender" });

await upsert("pools", [
  {
    id: poolId,
    name: "Roland Friends 2026",
    commissioner_user_id: demoUser.id,
    invite_code: "CLAY26",
    created_at: now
  }
], { onConflict: "id" });

await upsert("pool_members", [
  { id: uuid("member:demo"), pool_id: poolId, user_id: demoUser.id, role: "commissioner", joined_at: now },
  { id: uuid("member:sam"), pool_id: poolId, user_id: samUser.id, role: "member", joined_at: now },
  { id: uuid("member:nora"), pool_id: poolId, user_id: noraUser.id, role: "member", joined_at: now }
], { onConflict: "pool_id,user_id" });

await upsert("tournaments", [
  {
    id: tournamentId,
    pool_id: poolId,
    tournament_instance_id: tournamentInstanceId,
    name: "French Open 2026 Men's Singles",
    slam_type: "french_open",
    year: 2026,
    gender: "men",
    status: "picking_open",
    bracket_size: 128,
    picking_deadline: deadline,
    external_provider_id: "mock-roland-garros-2026-men",
    last_synced_at: null,
    created_at: now
  }
], { onConflict: "id" });

await upsert("pool_tournaments", [
  {
    id: uuid("pool-tournament:roland-friends-2026-men"),
    pool_id: poolId,
    tournament_id: tournamentId,
    tournament_instance_id: tournamentInstanceId,
    picking_deadline: deadline,
    locked_at: null,
    commissioner_notes: "Mock staged Grand Slam lifecycle with qualifier placeholders.",
    created_at: now
  }
], { onConflict: "pool_id,tournament_instance_id" });

const rounds = [
  ["Round of 128", 1],
  ["Round of 64", 2],
  ["Round of 32", 4],
  ["Round of 16", 8],
  ["Quarterfinal", 16],
  ["Semifinal", 32],
  ["Final", 64]
].map(([roundName, points], index) => ({
  id: uuid(`round:${index + 1}`),
  tournament_id: tournamentId,
  round_number: index + 1,
  round_name: roundName,
  points_per_correct_pick: points
}));
await upsert("tournament_rounds", rounds, { onConflict: "tournament_id,round_number" });

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

const players = Array.from({ length: 128 }, (_, index) => {
  const playerNumber = index + 1;
  const isPlaceholder = playerNumber > 112;
  return {
    id: uuid(`player:${playerNumber}`),
    external_provider_id: `mock-player_${playerNumber}`,
    name: isPlaceholder
      ? `Qualifier / Lucky Loser ${playerNumber - 112}`
      : `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`,
    country: isPlaceholder ? null : countries[index % countries.length],
    seed: playerNumber <= 32 ? playerNumber : null
  };
});
await upsert("players", players, { onConflict: "id" });

const playerIdByPosition = new Map(players.map((player, index) => [index + 1, player.id]));
const drawSlots = players.map((player, index) => {
  const position = index + 1;
  const isPlaceholder = player.name.startsWith("Qualifier / Lucky Loser");
  return {
    id: uuid(`slot:${position}`),
    tournament_instance_id: tournamentInstanceId,
    position,
    side: position <= 64 ? "top" : "bottom",
    section: Math.ceil(position / 16),
    seed: player.seed,
    player_id: player.id,
    placeholder_label: isPlaceholder ? player.name : null,
    resolved_at: isPlaceholder ? null : now,
    external_provider_slot_id: `mock-slot-${position}`,
    updated_at: now
  };
});
await upsert("draw_slots", drawSlots, { onConflict: "tournament_instance_id,position" });

const slotIdByPosition = new Map(drawSlots.map((slot) => [slot.position, slot.id]));
const roundSlugs = { 1: "r128", 2: "r64", 3: "r32", 4: "r16", 5: "qf", 6: "sf", 7: "final" };
const matches = Array.from({ length: 7 }).flatMap((_, roundIndex) => {
  const roundNumber = roundIndex + 1;
  const matchesInRound = 64 / Math.pow(2, roundIndex);
  return Array.from({ length: matchesInRound }, (__, matchIndex) => {
    const matchNumber = matchIndex + 1;
    const player1Position = matchIndex * 2 + 1;
    const player2Position = matchIndex * 2 + 2;
    return {
      id: uuid(`match:${roundSlugs[roundNumber]}:${matchNumber}`),
      tournament_id: tournamentId,
      tournament_instance_id: tournamentInstanceId,
      round_number: roundNumber,
      match_number: matchNumber,
      player1_draw_slot_id: roundNumber === 1 ? slotIdByPosition.get(player1Position) : null,
      player2_draw_slot_id: roundNumber === 1 ? slotIdByPosition.get(player2Position) : null,
      winner_draw_slot_id: null,
      player1_id: roundNumber === 1 ? playerIdByPosition.get(player1Position) : null,
      player2_id: roundNumber === 1 ? playerIdByPosition.get(player2Position) : null,
      winner_player_id: null,
      status: "scheduled",
      start_time: null,
      score_summary: null,
      external_provider_match_id: `mock-${roundSlugs[roundNumber]}-${matchNumber}`,
      next_match_id: null,
      next_match_slot: null,
      updated_at: now
    };
  });
});

await upsert("matches", matches, { onConflict: "id" });

for (const match of matches) {
  if (match.round_number === 7) continue;
  const nextRound = match.round_number + 1;
  const nextMatchNumber = Math.ceil(match.match_number / 2);
  await update("matches", {
    next_match_id: uuid(`match:${roundSlugs[nextRound]}:${nextMatchNumber}`),
    next_match_slot: match.match_number % 2 === 1 ? "player1" : "player2"
  }, "id", match.id);
}

console.log("Seeded Supabase with:");
console.log(`- Pool: Roland Friends 2026 / invite CLAY26`);
console.log(`- Tournament: French Open 2026 Men's Singles`);
console.log(`- Demo login: demo@racketbracket.app / ${demoPassword}`);
console.log(`- Players: ${players.length}`);
console.log(`- Matches: ${matches.length}`);
