import { NextResponse } from "next/server";
import { isSupabaseConfigured, setTournamentStatusInSupabase } from "@/lib/supabase/persistence";
import type { TournamentStatus } from "@/lib/types";

const ALLOWED: ReadonlyArray<TournamentStatus> = ["setup", "picking_open", "locked", "in_progress", "completed"];

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { tournamentId, status } = await request.json();
  if (!tournamentId || !ALLOWED.includes(status)) {
    return NextResponse.json({ ok: false, error: "tournamentId and a valid status are required." }, { status: 400 });
  }

  try {
    await setTournamentStatusInSupabase({ tournamentId, status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update tournament status." },
      { status: 500 }
    );
  }
}
