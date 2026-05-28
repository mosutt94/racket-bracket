"use client";

import { getCurrentUser, loadState, saveState } from "@/lib/demo-store";
import type { AppState, Profile } from "@/lib/types";

export async function loadAppState(): Promise<AppState> {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load server state.");
    const state = (await response.json()) as AppState;
    saveState(state);
    return state;
  } catch {
    return loadState();
  }
}

export function getCurrentUserForState(state: AppState): Profile {
  const stored = getCurrentUser();
  return state.profiles.find((profile) => profile.email === stored.email) ?? stored;
}
