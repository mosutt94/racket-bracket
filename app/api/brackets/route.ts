import { NextResponse } from "next/server";
import { getBracketBundle, isSupabaseConfigured, saveBracket } from "@/lib/supabase/persistence";

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }
  const params = new URL(request.url).searchParams;
  try {
    return NextResponse.json(
      await getBracketBundle({
        poolId: params.get("poolId"),
        tournamentId: params.get("tournamentId"),
        userId: params.get("userId")
      })
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load brackets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { poolId, tournamentId, userId, status = "draft", submittedAt = null, lockedAt = null, picks = [], bracketId } = await request.json();

  if (!poolId || !tournamentId || !userId) {
    return NextResponse.json({ ok: false, error: "poolId, tournamentId, and userId are required." }, { status: 400 });
  }

  try {
    const result = await saveBracket({
      bracketId,
      poolId,
      tournamentId,
      userId,
      status,
      submittedAt,
      lockedAt,
      picks
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not save bracket." },
      { status: 500 }
    );
  }
}
