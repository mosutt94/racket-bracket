import { getCommissionerUserId } from "./cookie";
import { isCommissionerOfPool, isCommissionerOfAnyPoolForTournament, getProfileEmailById } from "@/lib/supabase/persistence";

// Returned rather than thrown so each route can emit a clean JSON 401/403.
export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string };

// Site owner(s): the people allowed to manage the SHARED tournament (draw import,
// tags, results sync, corrections, recalc). Configured via the SITE_ADMIN_EMAILS
// env var (comma-separated). When unset, ownership isn't enforced yet and we fall
// back to the old per-tournament commissioner check so nothing locks up.
function getSiteAdminEmails(): string[] {
  return (process.env.SITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSiteOwnerConfigured(): boolean {
  return getSiteAdminEmails().length > 0;
}

/** True if the current signed-in (cookie) user is a designated site owner. */
export async function isCurrentUserSiteOwner(): Promise<boolean> {
  const admins = getSiteAdminEmails();
  if (admins.length === 0) return false;
  const userId = getCommissionerUserId();
  if (!userId) return false;
  const email = (await getProfileEmailById(userId))?.toLowerCase();
  return Boolean(email && admins.includes(email));
}

/**
 * Caller must be a designated site owner. Until SITE_ADMIN_EMAILS is set, this
 * falls back to the existing per-tournament commissioner check, so the
 * restriction only takes effect once an owner is configured (no lockout).
 */
export async function requireSiteOwner(tournamentId: string | undefined | null): Promise<GuardResult> {
  const admins = getSiteAdminEmails();
  if (admins.length === 0) return requireCommissionerForTournament(tournamentId);
  const userId = getCommissionerUserId();
  if (!userId) return { ok: false, status: 401, error: "Sign in as the site owner to do that." };
  const email = (await getProfileEmailById(userId))?.toLowerCase();
  if (!email || !admins.includes(email)) {
    return { ok: false, status: 403, error: "Only the site owner can manage the shared draw." };
  }
  return { ok: true, userId };
}

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
