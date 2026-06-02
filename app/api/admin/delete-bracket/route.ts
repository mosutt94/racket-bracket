import { NextResponse } from "next/server";
import { deleteUserBracketInSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { poolId, tournamentId, userId } = await request.json();
  if (!poolId || !tournamentId || !userId) {
    return NextResponse.json({ ok: false, error: "poolId, tournamentId and userId are required." }, { status: 400 });
  }

  try {
    const result = await deleteUserBracketInSupabase({ poolId, tournamentId, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not delete submission." },
      { status: 500 }
    );
  }
}
