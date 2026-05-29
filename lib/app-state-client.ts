"use client";

import { getSavedCurrentUser } from "@/lib/current-user";
import type { AppState, Profile } from "@/lib/types";

export async function loadAppState(): Promise<AppState> {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Could not load app state (${response.status}): ${message}`);
  }
  return (await response.json()) as AppState;
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
