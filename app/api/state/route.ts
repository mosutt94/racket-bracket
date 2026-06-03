import { NextResponse } from "next/server";
import { getAppStateForPoolFromSupabase, getAppStateFromSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  // Pool pages pass ?poolId to load only that pool's slice of data (fast);
  // the dashboard omits it and gets the full cross-pool state.
  const poolId = new URL(request.url).searchParams.get("poolId");

  try {
    const state = poolId ? await getAppStateForPoolFromSupabase(poolId) : await getAppStateFromSupabase();
    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load app state." },
      { status: 500 }
    );
  }
}
