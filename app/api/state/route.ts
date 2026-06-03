import { NextResponse } from "next/server";
import {
  getAppStateForPoolFromSupabase,
  getAppStateForUserFromSupabase,
  getAppStateFromSupabase,
  isSupabaseConfigured
} from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  // Pool pages pass ?poolId for that pool's slice; the dashboard passes ?userId
  // for just the user's pools. Neither → the full cross-pool state (fallback).
  const searchParams = new URL(request.url).searchParams;
  const poolId = searchParams.get("poolId");
  const userId = searchParams.get("userId");

  try {
    const state = poolId
      ? await getAppStateForPoolFromSupabase(poolId)
      : userId
        ? await getAppStateForUserFromSupabase(userId)
        : await getAppStateFromSupabase();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load app state." },
      { status: 500 }
    );
  }
}
