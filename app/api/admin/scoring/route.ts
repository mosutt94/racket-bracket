import { NextResponse } from "next/server";
import { isSupabaseConfigured, isTournamentPickingClosedInSupabase, updateTournamentScoringInSupabase } from "@/lib/supabase/persistence";
import { requireCommissionerForTournament } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const body = await request.json();
  const tournamentId: string | undefined = body.tournamentId;
  const rounds = Array.isArray(body.rounds) ? body.rounds : null;

  if (!tournamentId || !rounds) {
    return NextResponse.json({ ok: false, error: "tournamentId and rounds are required." }, { status: 400 });
  }

  const guard = await requireCommissionerForTournament(tournamentId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  // Scoring is shared across every pool on this Slam, so freeze it once play
  // begins — otherwise one commissioner could re-score a live tournament for
  // everyone. Set the points before the tournament starts.
  if (await isTournamentPickingClosedInSupabase(tournamentId)) {
    return NextResponse.json(
      { ok: false, error: "Scoring is locked once the tournament has started." },
      { status: 403 }
    );
  }

  const normalized = rounds
    .filter((round: any) => Number.isInteger(round?.roundNumber) && Number.isFinite(round?.pointsPerCorrectPick))
    .map((round: any) => ({
      roundNumber: Number(round.roundNumber),
      pointsPerCorrectPick: Math.max(0, Math.floor(Number(round.pointsPerCorrectPick)))
    }));

  if (normalized.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one round is required." }, { status: 400 });
  }

  try {
    const result = await updateTournamentScoringInSupabase({ tournamentId, rounds: normalized });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update scoring." },
      { status: 500 }
    );
  }
}
