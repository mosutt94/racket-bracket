"use client";

import { initialState, demoUser } from "@/lib/seed";
import type { AppState, Bracket, BracketStatus, Match, ManualOverride, Pool, Profile, Tournament, TournamentRound } from "@/lib/types";
import { makeId } from "@/lib/utils";

const stateKey = "racket-bracket-state-v1";
const userKey = "racket-bracket-user-v1";

export function loadState(): AppState {
  if (typeof window === "undefined") return initialState;
  const stored = window.localStorage.getItem(stateKey);
  const state = normalizeState(stored ? (JSON.parse(stored) as AppState) : initialState);
  const repaired = ensureTournamentDraws(state);
  if (repaired !== state) saveState(repaired);
  return repaired;
}

export function saveState(state: AppState) {
  window.localStorage.setItem(stateKey, JSON.stringify(state));
}

export function resetState() {
  saveState(initialState);
}

export function getCurrentUser(): Profile {
  if (typeof window === "undefined") return demoUser;
  const stored = window.localStorage.getItem(userKey);
  return stored ? (JSON.parse(stored) as Profile) : demoUser;
}

export function getSavedCurrentUser(): Profile | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(userKey);
  return stored ? (JSON.parse(stored) as Profile) : null;
}

export function saveCurrentUser(profile: Profile) {
  window.localStorage.setItem(userKey, JSON.stringify(profile));
}

export function clearCurrentUser() {
  window.localStorage.removeItem(userKey);
}

export function createDemoProfile(email: string, displayName: string): Profile {
  return {
    id: makeId("user"),
    email,
    displayName,
    createdAt: new Date().toISOString()
  };
}

export function ensureProfile(state: AppState, profile: Profile) {
  return state.profiles.some((item) => item.id === profile.id) ? state : { ...state, profiles: [...state.profiles, profile] };
}

export function createPool(state: AppState, name: string, user: Profile): AppState {
  const pool: Pool = {
    id: makeId("pool"),
    name,
    commissionerUserId: user.id,
    inviteCode: makeInviteCode(name),
    createdAt: new Date().toISOString()
  };
  const tournamentBundle = createSeededTournamentBundle(pool.id);

  return {
    ...ensureProfile(state, user),
    pools: [...state.pools, pool],
    poolMembers: [
      ...state.poolMembers,
      { id: makeId("member"), poolId: pool.id, userId: user.id, role: "commissioner", joinedAt: new Date().toISOString() }
    ],
    tournaments: [...state.tournaments, tournamentBundle.tournament],
    tournamentInstances: state.tournamentInstances.some((instance) => instance.id === tournamentBundle.tournament.tournamentInstanceId)
      ? state.tournamentInstances
      : [...state.tournamentInstances, ...initialState.tournamentInstances],
    poolTournaments: [
      ...state.poolTournaments,
      {
        id: makeId("pool_tournament"),
        poolId: pool.id,
        tournamentId: tournamentBundle.tournament.id,
        tournamentInstanceId: tournamentBundle.tournament.tournamentInstanceId ?? "instance_french_2026_men",
        pickingDeadline: tournamentBundle.tournament.pickingDeadline,
        lockedAt: null,
        commissionerNotes: "Created with mock Grand Slam draw.",
        createdAt: new Date().toISOString()
      }
    ],
    rounds: [...state.rounds, ...tournamentBundle.rounds],
    matches: [...state.matches, ...tournamentBundle.matches],
    drawSlots: [
      ...state.drawSlots,
      ...initialState.drawSlots.filter(
        (slot) => !state.drawSlots.some((existing) => existing.tournamentInstanceId === slot.tournamentInstanceId && existing.position === slot.position)
      )
    ]
  };
}

export function joinPool(state: AppState, inviteCode: string, user: Profile): AppState {
  const pool = state.pools.find((item) => item.inviteCode.toLowerCase() === inviteCode.trim().toLowerCase());
  if (!pool) throw new Error("Invite code not found.");
  if (state.poolMembers.some((item) => item.poolId === pool.id && item.userId === user.id)) return ensureProfile(state, user);

  return {
    ...ensureProfile(state, user),
    poolMembers: [
      ...state.poolMembers,
      { id: makeId("member"), poolId: pool.id, userId: user.id, role: "member", joinedAt: new Date().toISOString() }
    ]
  };
}

export function getOrCreateBracket(state: AppState, poolId: string, tournamentId: string, userId: string): [AppState, Bracket] {
  const existing = state.brackets.find(
    (item) => item.poolId === poolId && item.tournamentId === tournamentId && item.userId === userId
  );
  if (existing) return [state, existing];

  const bracket: Bracket = {
    id: makeId("bracket"),
    poolId,
    tournamentId,
    userId,
    submittedAt: null,
    lockedAt: null,
    totalScore: 0,
    status: "draft"
  };
  const nextState = { ...state, brackets: [...state.brackets, bracket] };
  return [nextState, bracket];
}

export function updateBracketStatus(state: AppState, bracketId: string, status: BracketStatus): AppState {
  return {
    ...state,
    brackets: state.brackets.map((bracket) =>
      bracket.id === bracketId
        ? {
            ...bracket,
            status,
            submittedAt: status === "submitted" ? new Date().toISOString() : bracket.submittedAt,
            lockedAt: status === "locked" ? new Date().toISOString() : bracket.lockedAt
          }
        : bracket
    )
  };
}

export function updateMatchResult(state: AppState, matchId: string, winnerPlayerId: string | null, scoreSummary: string): AppState {
  const editedMatch = state.matches.find((match) => match.id === matchId);
  const matches = state.matches.map((match) =>
    match.id === matchId
      ? {
          ...match,
          winnerPlayerId,
          scoreSummary,
          status: winnerPlayerId ? ("completed" as const) : ("scheduled" as const),
          updatedAt: new Date().toISOString()
        }
      : match
  );

  const completedMatch = matches.find((match) => match.id === matchId);
  const advancedMatches = completedMatch?.nextMatchId
    ? advanceRealWinner(matches, completedMatch, winnerPlayerId)
    : matches;

  const overrides: ManualOverride[] = editedMatch
    ? [
        {
          id: makeId("override"),
          tournamentInstanceId: editedMatch.tournamentInstanceId ?? editedMatch.tournamentId,
          tournamentId: editedMatch.tournamentId,
          matchId,
          overrideType: "match_winner",
          locked: true,
          value: { winnerPlayerId, scoreSummary },
          createdByUserId: getCurrentUser().id,
          createdAt: new Date().toISOString()
        }
      ]
    : [];

  return { ...state, matches: advancedMatches, manualOverrides: [...state.manualOverrides, ...overrides] };
}

export function updateMatchPlayerSlot(state: AppState, matchId: string, slot: "player1" | "player2", values: { name: string; country?: string; seed?: number | null }): AppState {
  const editedMatch = state.matches.find((match) => match.id === matchId);
  const playerId = slot === "player1" ? editedMatch?.player1Id : editedMatch?.player2Id;
  if (!editedMatch || !playerId || !values.name.trim()) return state;

  const players = state.players.map((player) =>
    player.id === playerId
      ? {
          ...player,
          name: values.name.trim(),
          country: values.country?.trim() || player.country,
          seed: values.seed === undefined ? player.seed : values.seed,
          externalProviderId: player.externalProviderId ?? `manual-${editedMatch.tournamentInstanceId}-${slot}-${matchId}`
        }
      : player
  );
  const drawSlotId = slot === "player1" ? editedMatch.player1DrawSlotId : editedMatch.player2DrawSlotId;
  const drawSlots = state.drawSlots.map((drawSlot) =>
    drawSlot.id === drawSlotId
      ? {
          ...drawSlot,
          seed: values.seed === undefined ? drawSlot.seed : values.seed,
          placeholderLabel: null,
          resolvedAt: drawSlot.resolvedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      : drawSlot
  );

  return {
    ...state,
    players,
    drawSlots,
    manualOverrides: [
      ...state.manualOverrides,
      {
        id: makeId("override"),
        tournamentInstanceId: editedMatch.tournamentInstanceId ?? editedMatch.tournamentId,
        tournamentId: editedMatch.tournamentId,
        matchId,
        drawSlotId,
        overrideType: "player_slot",
        locked: true,
        value: { slot, playerId, ...values },
        createdByUserId: getCurrentUser().id,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

export function clearManualOverridesForMatch(state: AppState, matchId: string): AppState {
  return {
    ...state,
    manualOverrides: state.manualOverrides.map((override) =>
      override.matchId === matchId ? { ...override, locked: false } : override
    )
  };
}

export function updateRoundPoints(state: AppState, rounds: TournamentRound[]) {
  return {
    ...state,
    rounds: state.rounds.map((round) => rounds.find((item) => item.id === round.id) ?? round)
  };
}

export function importDrawSlotJson(state: AppState, tournamentId: string, rawJson: string): AppState {
  const tournament = state.tournaments.find((item) => item.id === tournamentId);
  if (!tournament?.tournamentInstanceId) return state;
  const rows = JSON.parse(rawJson) as Array<{ position: number; name: string; country?: string | null; seed?: number | null }>;
  const validRows = rows.filter((row) => row.position >= 1 && row.position <= 128 && row.name);
  const players = [...state.players];
  const drawSlots = [...state.drawSlots];

  for (const row of validRows) {
    const slotIndex = drawSlots.findIndex(
      (slot) => slot.tournamentInstanceId === tournament.tournamentInstanceId && slot.position === row.position
    );
    if (slotIndex < 0) continue;
    const existingSlot = drawSlots[slotIndex];
    const playerIndex = players.findIndex((player) => player.id === existingSlot.playerId);
    if (playerIndex >= 0) {
      players[playerIndex] = {
        ...players[playerIndex],
        name: row.name,
        country: row.country ?? players[playerIndex].country,
        seed: row.seed ?? players[playerIndex].seed,
        externalProviderId: players[playerIndex].externalProviderId ?? `manual-${tournament.tournamentInstanceId}-${row.position}`
      };
    }
    drawSlots[slotIndex] = {
      ...existingSlot,
      seed: row.seed ?? existingSlot.seed,
      placeholderLabel: null,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return {
    ...state,
    players,
    drawSlots,
    manualOverrides: [
      ...state.manualOverrides,
      {
        id: makeId("override"),
        tournamentInstanceId: tournament.tournamentInstanceId,
        tournamentId,
        overrideType: "player_slot",
        locked: true,
        value: { importedRows: validRows.length },
        createdByUserId: getCurrentUser().id,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function advanceRealWinner(matches: Match[], match: Match, winnerPlayerId: string | null) {
  return matches.map((candidate) => {
    if (candidate.id !== match.nextMatchId || !match.nextMatchSlot) return candidate;
    return {
      ...candidate,
      [`${match.nextMatchSlot}Id`]: winnerPlayerId,
      winnerPlayerId: candidate.winnerPlayerId === winnerPlayerId ? candidate.winnerPlayerId : null,
      updatedAt: new Date().toISOString()
    };
  });
}

function makeInviteCode(name: string) {
  const letters = name.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase() || "POOL";
  return `${letters}${Math.floor(100 + Math.random() * 900)}`;
}

function ensureTournamentDraws(state: AppState): AppState {
  const fullDrawMatchCount = 127;
  const tournamentsNeedingFullDraw = state.tournaments.filter(
    (tournament) =>
      tournament.bracketSize !== 128 ||
      state.matches.filter((match) => match.tournamentId === tournament.id).length < fullDrawMatchCount
  );
  const players = [
    ...state.players,
    ...initialState.players.filter((player) => !state.players.some((existing) => existing.id === player.id))
  ];

  if (tournamentsNeedingFullDraw.length === 0 && players.length === state.players.length) return state;

  let nextState = { ...state, players };
  const tournamentIdsToReplace = new Set(tournamentsNeedingFullDraw.map((tournament) => tournament.id));
  const bracketIdsToClear = new Set(
    state.brackets.filter((bracket) => tournamentIdsToReplace.has(bracket.tournamentId)).map((bracket) => bracket.id)
  );

  if (tournamentIdsToReplace.size > 0) {
    nextState = {
      ...nextState,
      rounds: nextState.rounds.filter((round) => !tournamentIdsToReplace.has(round.tournamentId)),
      matches: nextState.matches.filter((match) => !tournamentIdsToReplace.has(match.tournamentId)),
      bracketPicks: nextState.bracketPicks.filter((pick) => !bracketIdsToClear.has(pick.bracketId)),
      scoreEvents: nextState.scoreEvents.filter((event) => !tournamentIdsToReplace.has(event.tournamentId)),
      brackets: nextState.brackets.map((bracket) =>
        tournamentIdsToReplace.has(bracket.tournamentId)
          ? { ...bracket, totalScore: 0, status: "draft", submittedAt: null, lockedAt: null }
          : bracket
      )
    };
  }

  for (const tournament of tournamentsNeedingFullDraw) {
    // demo-store is on its way out; pass a stable string for the legacy poolId param.
    const bundle = createSeededTournamentBundle("demo-pool", tournament);
    nextState = {
      ...nextState,
      tournaments: nextState.tournaments.map((item) => (item.id === tournament.id ? bundle.tournament : item)),
      rounds: [...nextState.rounds, ...bundle.rounds],
      matches: [...nextState.matches, ...bundle.matches]
    };
  }

  return nextState;
}

function normalizeState(state: AppState): AppState {
  return {
    ...state,
    tournamentInstances: state.tournamentInstances ?? initialState.tournamentInstances,
    poolTournaments: state.poolTournaments ?? initialState.poolTournaments,
    drawSlots: state.drawSlots ?? initialState.drawSlots,
    providerSyncRuns: state.providerSyncRuns ?? [],
    manualOverrides: state.manualOverrides ?? [],
    tournaments: state.tournaments.map((tournament) => ({
      ...tournament,
      tournamentInstanceId: tournament.tournamentInstanceId ?? initialState.tournamentInstances[0]?.id ?? null
    })),
    matches: state.matches.map((match) => ({
      ...match,
      tournamentInstanceId: match.tournamentInstanceId ?? initialState.tournamentInstances[0]?.id ?? null
    }))
  };
}

function createSeededTournamentBundle(poolId: string, existingTournament?: Tournament) {
  const seededTournamentId = "tournament_french_2026_men";
  const seededTournament = initialState.tournaments.find((item) => item.id === seededTournamentId);
  if (!seededTournament) throw new Error("Seed tournament is missing.");

  const tournament: Tournament = {
    ...seededTournament,
    ...existingTournament,
    id: existingTournament?.id ?? makeId("tournament"),
    tournamentInstanceId: existingTournament?.tournamentInstanceId ?? seededTournament.tournamentInstanceId,
    name: seededTournament.name,
    status: existingTournament?.status ?? "picking_open",
    lastSyncedAt: existingTournament?.lastSyncedAt ?? null,
    externalProviderId: existingTournament?.externalProviderId ?? `${seededTournament.externalProviderId}-${poolId}`
  };

  const rounds = initialState.rounds
    .filter((round) => round.tournamentId === seededTournamentId)
    .map((round) => {
      const id = makeId("round");
      return {
        ...round,
        id,
        tournamentId: tournament.id
      };
    });

  const matchIdBySeedId = new Map<string, string>();
  const seededMatches = initialState.matches.filter((match) => match.tournamentId === seededTournamentId);
  for (const match of seededMatches) {
    matchIdBySeedId.set(match.id, makeId("match"));
  }

  const matches = seededMatches.map((match) => ({
    ...match,
    id: matchIdBySeedId.get(match.id) ?? makeId("match"),
    tournamentId: tournament.id,
    winnerPlayerId: null,
    status: "scheduled" as const,
    scoreSummary: null,
    externalProviderMatchId: `${match.externalProviderMatchId}-${poolId}`,
    nextMatchId: match.nextMatchId ? matchIdBySeedId.get(match.nextMatchId) ?? null : null,
    updatedAt: new Date().toISOString()
  }));

  return { tournament, rounds, matches };
}
