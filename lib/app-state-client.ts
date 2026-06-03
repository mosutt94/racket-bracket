"use client";

import { getSavedCurrentUser } from "@/lib/current-user";
import type { AppState, Profile } from "@/lib/types";

// Last successfully-loaded state, kept in memory for the SPA session. Pages seed
// their initial render from this so client-side navigation shows content
// immediately instead of flashing blank while a fresh /api/state fetch runs.
let cachedAppState: AppState | null = null;

/** Synchronously returns the last-loaded app state (or null on a cold start). */
export function getCachedAppState(): AppState | null {
  return cachedAppState;
}

export async function loadAppState(): Promise<AppState> {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Could not load app state (${response.status}): ${message}`);
  }
  const state = (await response.json()) as AppState;
  cachedAppState = state;
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
