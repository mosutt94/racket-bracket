import { NextResponse } from "next/server";
import { initialState } from "@/lib/seed";
import { getAppStateFromSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) return NextResponse.json(initialState);

  try {
    return NextResponse.json(await getAppStateFromSupabase());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load app state." }, { status: 500 });
  }
}
