import { NextResponse } from "next/server";
import { getLiveMatchesDelta, isSupabaseConfigured } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

// Polled by pages during live play: returns the tournament row plus only the
// matches changed since the client's updated_at watermark — a few KB instead
// of the full pool state. Public data, same exposure as /api/state.
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }
  const params = new URL(request.url).searchParams;
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ ok: false, error: "tournamentId is required." }, { status: 400 });
  }
  try {
    const delta = await getLiveMatchesDelta(tournamentId, params.get("since"));
    return NextResponse.json({ ok: true, ...delta });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load match updates." },
      { status: 500 }
    );
  }
}
