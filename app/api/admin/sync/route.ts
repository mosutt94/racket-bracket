import { NextResponse } from "next/server";
import { isSupabaseConfigured, syncEspnLiveUpdatesInSupabase } from "@/lib/supabase/persistence";
import { requireCommissionerForTournament } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Live sync requires Supabase." }, { status: 400 });
  }

  const { tournamentId, tournamentInstanceId, syncType = "manual", ifStaleMinutes } = await request.json();
  if (!tournamentId || !tournamentInstanceId) {
    return NextResponse.json({ ok: false, error: "tournamentId and tournamentInstanceId are required." }, { status: 400 });
  }

  // The background auto-sync (stale-gated) fires on every leaderboard/my-bracket
  // load by every member and only pulls public ESPN results into shared rows, so
  // it stays open. A manual/forced sync requires the commissioner.
  const isBackground = syncType === "auto" && typeof ifStaleMinutes === "number" && ifStaleMinutes > 0;
  if (!isBackground) {
    const guard = await requireCommissionerForTournament(tournamentId);
    if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  }

  try {
    const result = await syncEspnLiveUpdatesInSupabase({
      tournamentId,
      tournamentInstanceId,
      ifStaleMinutes: typeof ifStaleMinutes === "number" ? ifStaleMinutes : undefined
    });
    return NextResponse.json({ ok: true, providerName: "espn", syncType, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not record sync." }, { status: 500 });
  }
}
