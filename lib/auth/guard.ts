import { getCommissionerUserId } from "./cookie";
import { isCommissionerOfPool, isCommissionerOfAnyPoolForTournament } from "@/lib/supabase/persistence";

// Returned rather than thrown so each route can emit a clean JSON 401/403.
export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

/** Caller (from the commissioner cookie) must be the commissioner of THIS pool. */
export async function requireCommissionerForPool(poolId: string | undefined | null): Promise<GuardResult> {
  const userId = getCommissionerUserId();
  if (!userId) return { ok: false, status: 401, error: "Sign in as the commissioner to do that." };
  if (!poolId) return { ok: false, status: 403, error: "poolId is required." };
  if (!(await isCommissionerOfPool(userId, poolId))) {
    return { ok: false, status: 403, error: "Only this bracket's commissioner can do that." };
  }
  return { ok: true, userId };
}

/**
 * Caller must commission at least one pool attached to this tournament
 * (shared-tournament model — a tournamentId maps to several commissioners).
 */
export async function requireCommissionerForTournament(tournamentId: string | undefined | null): Promise<GuardResult> {
  const userId = getCommissionerUserId();
  if (!userId) return { ok: false, status: 401, error: "Sign in as the commissioner to do that." };
  if (!tournamentId) return { ok: false, status: 403, error: "tournamentId is required." };
  if (!(await isCommissionerOfAnyPoolForTournament(userId, tournamentId))) {
    return { ok: false, status: 403, error: "Only a commissioner of a bracket in this draw can do that." };
  }
  return { ok: true, userId };
}
