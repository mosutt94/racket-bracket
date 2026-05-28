"use client";

import type { Profile } from "@/lib/types";

/**
 * Tiny client-side identity store. The app doesn't have full Supabase auth yet,
 * so we cache the signed-in profile in localStorage and pass the email to
 * API routes (which use email-keyed lookups via getOrCreateProfileByEmail).
 *
 * After sign-in the cached profile has a real Supabase id (returned by
 * /api/auth/identify). On subsequent state loads, getCurrentUserForState
 * cross-references by email so the displayed identity always matches the DB.
 */

const STORAGE_KEY = "racket-bracket-user-v1";

export function getSavedCurrentUser(): Profile | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored ? (JSON.parse(stored) as Profile) : null;
}

export function saveCurrentUser(profile: Profile) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearCurrentUser() {
  window.localStorage.removeItem(STORAGE_KEY);
}
