import { NextResponse } from "next/server";
import { isSupabaseConfigured, leaveBracketInSupabase } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

/**
 * A user deletes their own bracket (and leaves the pool) before the tournament
 * starts. Rejected once picks are locked / the tournament is underway, and the
 * commissioner can't delete their own bracket this way.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { poolId, userId } = await request.json();
  if (!poolId || !userId) {
    return NextResponse.json({ ok: false, error: "poolId and userId are required." }, { status: 400 });
  }

  try {
    const result = await leaveBracketInSupabase({ poolId, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not delete your bracket." },
      { status: 400 }
    );
  }
}
