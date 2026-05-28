import type { AppState, Tournament } from "@/lib/types";

/**
 * Finds the Grand Slam tournament a pool is tracking. After the shared-instance
 * refactor, one tournament can be shared by many pools, so the lookup goes
 * through the pool_tournaments join table rather than a tournament.poolId field.
 */
export function findTournamentForPool(state: AppState, poolId: string): Tournament | undefined {
  const poolTournament = state.poolTournaments.find((item) => item.poolId === poolId);
  if (!poolTournament) return undefined;
  return state.tournaments.find((item) => item.id === poolTournament.tournamentId);
}
