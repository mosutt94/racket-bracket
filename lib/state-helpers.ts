import type { AppState, Tournament, TournamentRound } from "@/lib/types";

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
 * Whether bracket picks are closed (frozen). Picks close when:
 *  1. This pool's commissioner locked it early (per-pool `poolLockedAt`), or
 *  2. The Slam itself has started — the commissioner set a non-"picking_open"
 *     status, or the auto-lock picking deadline passed. Once play begins everyone
 *     is locked regardless of the per-pool flag.
 * Prefer isPoolPickingClosed(state, poolId) at call sites; this is the primitive.
 */
export function isPickingClosed(
  tournament: Pick<Tournament, "status" | "pickingDeadline">,
  poolLockedAt?: string | null
): boolean {
  if (poolLockedAt) return true;
  if (tournament.status !== "picking_open") return true;
  if (!tournament.pickingDeadline) return false;
  const deadline = new Date(tournament.pickingDeadline).getTime();
  return !Number.isNaN(deadline) && Date.now() >= deadline;
}

/** Per-pool picking-closed: the shared Slam start OR this pool's own early lock. */
export function isPoolPickingClosed(state: AppState, poolId: string): boolean {
  const tournament = findTournamentForPool(state, poolId);
  if (!tournament) return false;
  const poolTournament = state.poolTournaments.find((item) => item.poolId === poolId);
  return isPickingClosed(tournament, poolTournament?.lockedAt ?? null);
}

/**
 * Whether the real ESPN draw has landed for this tournament's Slam.
 *
 * A fresh bracket shell is seeded with 128 placeholder slots ("TBD 1".."TBD 128")
 * and the ESPN import clears `placeholderLabel` as it writes real names in. ESPN
 * doesn't publish a Grand Slam draw until a few days before round 1, so there is
 * a real window where a pool exists, picking is open, and every slot is still TBD.
 *
 * Picks made in that window are worse than useless: importEspnDrawInSupabase
 * refuses to run once any pick exists unless you also clear every bracket on the
 * Slam, so one early pick forces a full wipe for every pool. Call sites use this
 * to keep picking shut until there's a real draw to pick against.
 */
export function isDrawPublished(state: AppState, tournament: Pick<Tournament, "tournamentInstanceId">): boolean {
  const slots = state.drawSlots.filter((slot) => slot.tournamentInstanceId === tournament.tournamentInstanceId);
  // No slots loaded (a scoped state read that didn't include them) — don't claim
  // the draw is missing and block picking on incomplete information.
  if (slots.length === 0) return true;

  const playerNamesById = new Map(state.players.map((player) => [player.id, player.name]));
  return slots.every((slot) => {
    if (slot.placeholderLabel) return false;
    // An import run before ESPN filled the bracket in clears placeholderLabel but
    // writes ESPN's own "TBD" through as the player name, so the label alone isn't
    // enough. ("Qualifier"/"Wild Card" are real, expected draw entries — those
    // don't count as unpublished.)
    return !isPlaceholderPlayerName(playerNamesById.get(slot.playerId));
  });
}

/** "TBD", "TBD 17", "" — the names a not-yet-published draw leaves behind. */
function isPlaceholderPlayerName(name: string | undefined): boolean {
  if (!name) return true;
  return /^tbd\b/i.test(name.trim());
}

/**
 * The effective points-per-round for a pool: its own pool_round_scoring overrides,
 * falling back to the shared tournament_rounds. Returned in the tournament's round
 * shape (labels/order preserved) with only pointsPerCorrectPick overridden, so a
 * pool with no overrides yields the exact shared rounds (unchanged scoring).
 */
export function effectivePoolRounds(state: AppState, poolId: string, tournamentId: string): TournamentRound[] {
  const tournamentRounds = state.rounds.filter((round) => round.tournamentId === tournamentId);
  const overrides = new Map(
    state.poolRoundScoring.filter((s) => s.poolId === poolId).map((s) => [s.roundNumber, s.pointsPerCorrectPick])
  );
  if (overrides.size === 0) return tournamentRounds;
  return tournamentRounds.map((round) =>
    overrides.has(round.roundNumber) ? { ...round, pointsPerCorrectPick: overrides.get(round.roundNumber)! } : round
  );
}
