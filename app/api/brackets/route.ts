import { NextResponse } from "next/server";
import { initialState } from "@/lib/seed";
import { getBracketBundle, isSupabaseConfigured, saveBracket } from "@/lib/supabase/persistence";

export async function GET(request: Request) {
  if (isSupabaseConfigured()) {
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
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load brackets." }, { status: 500 });
    }
  }

  return NextResponse.json({ brackets: initialState.brackets, picks: initialState.bracketPicks });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { poolId, tournamentId, userId, status = "draft", submittedAt = null, lockedAt = null, picks = [], bracketId } = body;

  if (!poolId || !tournamentId || !userId) {
    return NextResponse.json({ ok: false, error: "poolId, tournamentId, and userId are required." }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
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
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save bracket." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, demoOnly: true, bracket: body });
}
