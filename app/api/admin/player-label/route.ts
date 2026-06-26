import { NextResponse } from "next/server";
import { isSupabaseConfigured, setPlayerDesignationInSupabase } from "@/lib/supabase/persistence";
import { requireCommissionerForTournament } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const ALLOWED = ["Q", "WC", "LL", "PR"];

/** Commissioner sets/clears a player's manual bracket label (Q/WC/LL/PR). */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { tournamentId, playerId, designation } = await request.json();
  if (!tournamentId || !playerId) {
    return NextResponse.json({ ok: false, error: "tournamentId and playerId are required." }, { status: 400 });
  }
  // null/empty clears the label; otherwise it must be one of the known labels.
  const value = designation === null || designation === "" ? null : ALLOWED.includes(designation) ? designation : undefined;
  if (value === undefined) {
    return NextResponse.json({ ok: false, error: "Label must be Q, WC, LL, or PR." }, { status: 400 });
  }

  const guard = await requireCommissionerForTournament(tournamentId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  try {
    await setPlayerDesignationInSupabase({ playerId, designation: value });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save label." },
      { status: 500 }
    );
  }
}
