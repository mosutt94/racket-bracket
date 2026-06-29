import { NextResponse } from "next/server";
import { isSupabaseConfigured, setPoolPickingLockInSupabase } from "@/lib/supabase/persistence";
import { requireCommissionerForPool } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** A commissioner locks/unlocks picking for THEIR pool (its own pool_tournaments.locked_at). */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { poolId, locked } = await request.json();
  if (!poolId || typeof locked !== "boolean") {
    return NextResponse.json({ ok: false, error: "poolId and locked (boolean) are required." }, { status: 400 });
  }

  const guard = await requireCommissionerForPool(poolId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  try {
    const result = await setPoolPickingLockInSupabase({ poolId, locked });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update lock." },
      { status: 500 }
    );
  }
}
