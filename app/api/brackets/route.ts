import { NextResponse } from "next/server";
import {
  getBracketBundle,
  isDrawPublishedInSupabase,
  isPoolTournamentPickingClosedInSupabase,
  isSupabaseConfigured,
  saveBracket
} from "@/lib/supabase/persistence";

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

  // Once picking is closed for this pool's Slam, picks are frozen for everyone —
  // enforced here on the server, not just hidden in the UI. This blocks editing a
  // bracket (draft or locked) after the tournament starts / the pool locks, so a
  // crafted request can't rewrite picks against already-decided matches.
  if (await isPoolTournamentPickingClosedInSupabase(poolId, tournamentId)) {
    return NextResponse.json(
      { ok: false, error: "Picking is closed for this bracket — picks can no longer be changed." },
      { status: 403 }
    );
  }

  // Reject picks made before the real draw exists. importEspnDrawInSupabase can't
  // fill in a draw once any pick exists without clearing every bracket on the
  // Slam, so a pick against "TBD 1..128" costs every other pool their entry. The
  // UI shows a waiting screen instead of a bracket, so this catches stale tabs and
  // crafted requests. Pick-less saves still pass, so creating an empty bracket
  // (and joining a pool) keeps working before the draw lands.
  if (Array.isArray(picks) && picks.length > 0 && !(await isDrawPublishedInSupabase(tournamentId))) {
    return NextResponse.json(
      { ok: false, error: "The draw for this tournament hasn't been published yet — picks open once it's imported." },
      { status: 409 }
    );
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
