import { NextResponse } from "next/server";
import { isSupabaseConfigured, syncEspnLiveUpdatesInSupabase } from "@/lib/supabase/persistence";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Live sync requires Supabase." }, { status: 400 });
  }

  const { tournamentId, tournamentInstanceId, syncType = "manual" } = await request.json();
  if (!tournamentId || !tournamentInstanceId) {
    return NextResponse.json({ ok: false, error: "tournamentId and tournamentInstanceId are required." }, { status: 400 });
  }

  try {
    const result = await syncEspnLiveUpdatesInSupabase({ tournamentId, tournamentInstanceId });
    return NextResponse.json({ ok: true, providerName: "espn", syncType, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not record sync." }, { status: 500 });
  }
}
