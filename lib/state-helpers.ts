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

/**
 * Whether bracket picks are closed (frozen). Two ways picking closes:
 *  1. The commissioner explicitly locked it (status is no longer "picking_open").
 *  2. The picking deadline has passed — an automatic lock at tournament start, so
 *     nobody can edit (or copy) once play begins even if the commissioner forgets.
 * Single source of truth shared by the bracket, leaderboard, and member pages.
 */
export function isPickingClosed(tournament: Pick<Tournament, "status" | "pickingDeadline">): boolean {
  if (tournament.status !== "picking_open") return true;
  if (!tournament.pickingDeadline) return false;
  const deadline = new Date(tournament.pickingDeadline).getTime();
  return !Number.isNaN(deadline) && Date.now() >= deadline;
}
