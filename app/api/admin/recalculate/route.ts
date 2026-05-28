import { NextResponse } from "next/server";
import { isSupabaseConfigured, recalculateTournamentScoresInSupabase } from "@/lib/supabase/persistence";

export async function POST(request: Request) {
  const { tournamentId } = await request.json();
  if (!tournamentId) return NextResponse.json({ ok: false, error: "tournamentId is required." }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 400 });

  try {
    const scoring = await recalculateTournamentScoresInSupabase(tournamentId);
    return NextResponse.json({ ok: true, scoring });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not recalculate scores." }, { status: 500 });
  }
}
