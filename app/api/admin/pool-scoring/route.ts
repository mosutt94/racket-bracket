import { NextResponse } from "next/server";
import { isPoolPickingClosedInSupabase, isSupabaseConfigured, setPoolRoundScoringInSupabase } from "@/lib/supabase/persistence";
import { requireCommissionerForPool } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** A commissioner sets THEIR pool's own points per round (overrides the shared default). */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const body = await request.json();
  const poolId: string | undefined = body.poolId;
  const rounds = Array.isArray(body.rounds) ? body.rounds : null;
  if (!poolId || !rounds) {
    return NextResponse.json({ ok: false, error: "poolId and rounds are required." }, { status: 400 });
  }

  const guard = await requireCommissionerForPool(poolId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  // Editing scoring after a pool's picks lock would shift its live leaderboard
  // mid-event — freeze it (same rule as the shared scoring lock, but per-pool).
  if (await isPoolPickingClosedInSupabase(poolId)) {
    return NextResponse.json({ ok: false, error: "Scoring is locked once the tournament has started." }, { status: 403 });
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
    const result = await setPoolRoundScoringInSupabase({ poolId, rounds: normalized });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update scoring." },
      { status: 500 }
    );
  }
}
