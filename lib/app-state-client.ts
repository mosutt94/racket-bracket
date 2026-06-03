"use client";

import { getSavedCurrentUser } from "@/lib/current-user";
import type { AppState, Profile } from "@/lib/types";

// Last successfully-loaded state, kept in memory for the SPA session so pages
// can seed their initial render and avoid a blank flash on navigation. Keyed by
// pool — a pool page loads only its own slice, so the full (dashboard) load and
// each pool's load are cached separately and never overwrite each other.
let cachedFullState: AppState | null = null;
let cachedDashboardState: AppState | null = null;
const cachedPoolState = new Map<string, AppState>();

/** Synchronously returns the last-loaded state for a pool (or the full state). */
export function getCachedAppState(poolId?: string): AppState | null {
  if (poolId) return cachedPoolState.get(poolId) ?? null;
  return cachedFullState;
}

/** Synchronously returns the last-loaded dashboard (user-scoped) state. */
export function getCachedDashboardState(): AppState | null {
  return cachedDashboardState;
}

/** Loads just the signed-in user's pools + tournaments for the dashboard. */
export async function loadDashboardState(userId: string): Promise<AppState> {
  const response = await fetch(`/api/state?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Could not load app state (${response.status}): ${message}`);
  }
  const state = (await response.json()) as AppState;
  cachedDashboardState = state;
  return state;
}

/**
 * Loads app state. Pass a poolId on pool pages to fetch only that pool's data
 * (much faster); omit it on the dashboard to get the full cross-pool state.
 */
export async function loadAppState(poolId?: string): Promise<AppState> {
  const url = poolId ? `/api/state?poolId=${encodeURIComponent(poolId)}` : "/api/state";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Could not load app state (${response.status}): ${message}`);
  }
  const state = (await response.json()) as AppState;
  if (poolId) cachedPoolState.set(poolId, state);
  else cachedFullState = state;
  return state;
}

/**
 * Returns the signed-in profile, preferring the canonical row from server state
 * (cross-referenced by email) so the id is always the real Supabase profile id.
 * If the user hasn't signed in yet, returns a minimal stub — callers should
 * generally redirect to /auth before relying on the id.
 */
export function getCurrentUserForState(state: AppState): Profile {
  const stored = getSavedCurrentUser();
  if (!stored) {
    return { id: "anonymous", email: "", displayName: "", createdAt: new Date().toISOString() };
  }
  return state.profiles.find((profile) => profile.email === stored.email) ?? stored;
}

/** Whether the signed-in user is the commissioner of the given pool. */
export function isPoolCommissioner(state: AppState, poolId: string): boolean {
  const pool = state.pools.find((item) => item.id === poolId);
  if (!pool) return false;
  return pool.commissionerUserId === getCurrentUserForState(state).id;
}
