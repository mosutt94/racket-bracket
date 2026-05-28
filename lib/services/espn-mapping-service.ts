import type { AppState, DrawSlot, Match, Player, ProviderMatch, Tournament } from "@/lib/types";

interface MappingRow {
  matchId: string;
  matchNumber: number;
  player1: string;
  player2: string;
  drawPositions: Array<number | null>;
  expectedDrawPositions: [number, number];
  topologyOk: boolean;
  espnMatchId?: string | null;
  espnPlayer1?: string | null;
  espnPlayer2?: string | null;
  espnStatus?: string | null;
  espnScore?: string | null;
  confidence: "exact" | "ambiguous" | "none";
  notes: string[];
}

export interface EspnMappingPreview {
  ok: boolean;
  tournamentId: string;
  topology: {
    ok: boolean;
    expectedMatches: number;
    actualMatches: number;
    issues: string[];
  };
  mapping: {
    exactCount: number;
    ambiguousCount: number;
    unmatchedCount: number;
    candidateCount: number;
    rows: MappingRow[];
  };
  importGuard: {
    canImport: boolean;
    bracketPickCount: number;
    reason?: string | null;
  };
}

export function buildEspnMappingPreview(state: AppState, tournamentId: string, providerMatches: ProviderMatch[]): EspnMappingPreview {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament) throw new Error("Tournament not found.");

  const matches = state.matches
    .filter((match) => match.tournamentId === tournamentId)
    .sort((a, b) => a.roundNumber - b.roundNumber || a.matchNumber - b.matchNumber);
  const playersById = new Map(state.players.map((player) => [player.id, player]));
  const drawSlotsById = new Map(state.drawSlots.map((slot) => [slot.id, slot]));
  const topology = validateBracketTopology(matches, drawSlotsById);
  const candidates = getProviderRoundOneCandidates(providerMatches, tournament);
  const candidateBuckets = bucketProviderMatches(candidates);
  const roundOne = matches.filter((match) => match.roundNumber === 1).sort((a, b) => a.matchNumber - b.matchNumber);

  const rows = roundOne.map((match): MappingRow => {
    const player1 = getPlayer(playersById, match.player1Id);
    const player2 = getPlayer(playersById, match.player2Id);
    const expectedDrawPositions: [number, number] = [match.matchNumber * 2 - 1, match.matchNumber * 2];
    const actualDrawPositions = [
      getDrawPosition(drawSlotsById, match.player1DrawSlotId),
      getDrawPosition(drawSlotsById, match.player2DrawSlotId)
    ];
    const candidatesForMatch = candidateBuckets.get(makePlayerPairKey(player1?.name, player2?.name)) ?? [];
    const notes: string[] = [];
    const topologyOk = actualDrawPositions[0] === expectedDrawPositions[0] && actualDrawPositions[1] === expectedDrawPositions[1];

    if (!topologyOk) {
      notes.push(`Expected draw slots ${expectedDrawPositions.join("/")} but found ${actualDrawPositions.map((value) => value ?? "missing").join("/")}.`);
    }

    if (!player1 || !player2) {
      notes.push("Internal match has missing player data.");
    }

    if (candidatesForMatch.length === 0) {
      notes.push("No ESPN first-round singles match has this exact player pair.");
    }

    if (candidatesForMatch.length > 1) {
      notes.push("Multiple ESPN candidates matched this player pair.");
    }

    const candidate = candidatesForMatch[0];
    return {
      matchId: match.id,
      matchNumber: match.matchNumber,
      player1: player1?.name ?? "TBD",
      player2: player2?.name ?? "TBD",
      drawPositions: actualDrawPositions,
      expectedDrawPositions,
      topologyOk,
      espnMatchId: candidate?.providerMatchId ?? null,
      espnPlayer1: candidate?.player1Name ?? null,
      espnPlayer2: candidate?.player2Name ?? null,
      espnStatus: candidate?.status ?? null,
      espnScore: candidate?.scoreSummary ?? null,
      confidence: candidatesForMatch.length === 1 ? "exact" : candidatesForMatch.length > 1 ? "ambiguous" : "none",
      notes
    };
  });

  const exactCount = rows.filter((row) => row.confidence === "exact").length;
  const ambiguousCount = rows.filter((row) => row.confidence === "ambiguous").length;
  const unmatchedCount = rows.filter((row) => row.confidence === "none").length;
  const bracketIds = new Set(state.brackets.filter((bracket) => bracket.tournamentId === tournamentId).map((bracket) => bracket.id));
  const bracketPickCount = state.bracketPicks.filter((pick) => bracketIds.has(pick.bracketId)).length;
  const importGuardReason = !topology.ok
    ? "Bracket topology must pass before import."
    : candidates.length !== 64
      ? "ESPN must provide exactly 64 first-round singles candidates before import."
      : bracketPickCount > 0
        ? "Cannot import a real ESPN draw after bracket picks exist. Create a fresh bracket or clear picks first."
        : null;

  return {
    ok: topology.ok && exactCount === 64 && ambiguousCount === 0 && unmatchedCount === 0,
    tournamentId,
    topology,
    mapping: {
      exactCount,
      ambiguousCount,
      unmatchedCount,
      candidateCount: candidates.length,
      rows
    },
    importGuard: {
      canImport: !importGuardReason,
      bracketPickCount,
      reason: importGuardReason
    }
  };
}

function validateBracketTopology(matches: Match[], drawSlotsById: Map<string, DrawSlot>) {
  const issues: string[] = [];
  const expectedByRound = new Map([
    [1, 64],
    [2, 32],
    [3, 16],
    [4, 8],
    [5, 4],
    [6, 2],
    [7, 1]
  ]);
  const matchesByRoundNumber = new Map<number, Match[]>();
  for (const match of matches) {
    matchesByRoundNumber.set(match.roundNumber, [...(matchesByRoundNumber.get(match.roundNumber) ?? []), match]);
  }

  for (const [roundNumber, expectedCount] of expectedByRound) {
    const actualCount = matchesByRoundNumber.get(roundNumber)?.length ?? 0;
    if (actualCount !== expectedCount) issues.push(`Round ${roundNumber} has ${actualCount} matches; expected ${expectedCount}.`);
  }

  for (const match of matches) {
    if (match.roundNumber === 7) {
      if (match.nextMatchId || match.nextMatchSlot) issues.push("Final should not advance to another match.");
      continue;
    }

    const expectedNextMatchNumber = Math.ceil(match.matchNumber / 2);
    const expectedNextSlot = match.matchNumber % 2 === 1 ? "player1" : "player2";
    const nextMatch = matches.find((candidate) => candidate.id === match.nextMatchId);
    if (!nextMatch) {
      issues.push(`Round ${match.roundNumber} match ${match.matchNumber} has no valid next match.`);
      continue;
    }
    if (nextMatch.roundNumber !== match.roundNumber + 1 || nextMatch.matchNumber !== expectedNextMatchNumber) {
      issues.push(`Round ${match.roundNumber} match ${match.matchNumber} advances to round ${nextMatch.roundNumber} match ${nextMatch.matchNumber}; expected round ${match.roundNumber + 1} match ${expectedNextMatchNumber}.`);
    }
    if (match.nextMatchSlot !== expectedNextSlot) {
      issues.push(`Round ${match.roundNumber} match ${match.matchNumber} advances to ${match.nextMatchSlot ?? "missing"}; expected ${expectedNextSlot}.`);
    }
  }

  for (const match of matches.filter((item) => item.roundNumber === 1)) {
    const expectedPositions = [match.matchNumber * 2 - 1, match.matchNumber * 2];
    const actualPositions = [
      getDrawPosition(drawSlotsById, match.player1DrawSlotId),
      getDrawPosition(drawSlotsById, match.player2DrawSlotId)
    ];
    if (actualPositions[0] !== expectedPositions[0] || actualPositions[1] !== expectedPositions[1]) {
      issues.push(`Round 1 match ${match.matchNumber} uses draw slots ${actualPositions.map((value) => value ?? "missing").join("/")}; expected ${expectedPositions.join("/")}.`);
    }
  }

  return {
    ok: issues.length === 0,
    expectedMatches: 127,
    actualMatches: matches.length,
    issues
  };
}

function getProviderRoundOneCandidates(matches: ProviderMatch[], tournament: Tournament) {
  const expectedEventType = tournament.gender === "women" ? "womens_singles" : "mens_singles";
  return matches.filter((match) => match.eventType === expectedEventType && normalizeRoundName(match.roundName) === "round1" && match.player1Name && match.player2Name);
}

function bucketProviderMatches(matches: ProviderMatch[]) {
  const buckets = new Map<string, ProviderMatch[]>();
  for (const match of matches) {
    const key = makePlayerPairKey(match.player1Name, match.player2Name);
    buckets.set(key, [...(buckets.get(key) ?? []), match]);
  }
  return buckets;
}

function getPlayer(playersById: Map<string, Player>, playerId?: string | null) {
  return playerId ? playersById.get(playerId) ?? null : null;
}

function getDrawPosition(drawSlotsById: Map<string, DrawSlot>, drawSlotId?: string | null) {
  return drawSlotId ? drawSlotsById.get(drawSlotId)?.position ?? null : null;
}

function makePlayerPairKey(player1?: string | null, player2?: string | null) {
  return [normalizePlayerName(player1), normalizePlayerName(player2)].sort().join("|");
}

function normalizePlayerName(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRoundName(value?: string | null) {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "round1" || normalized === "firstround") return "round1";
  return normalized;
}
