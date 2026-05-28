import { NextResponse } from "next/server";
import {
  clearManualOverridesForMatchInSupabase,
  isSupabaseConfigured,
  recalculateTournamentScoresInSupabase,
  recordManualMatchUpdate,
  recordManualPlayerSlotUpdate
} from "@/lib/supabase/persistence";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { matchId, winnerPlayerId, scoreSummary, tournamentId, tournamentInstanceId, createdByUserId, status, playerSlot, name, country, clearOverrides } = await request.json();

  if (!matchId) {
    return NextResponse.json({ ok: false, error: "matchId is required." }, { status: 400 });
  }
  if (!clearOverrides && (!tournamentInstanceId || !createdByUserId)) {
    return NextResponse.json(
      { ok: false, error: "tournamentInstanceId and createdByUserId are required for manual updates." },
      { status: 400 }
    );
  }

  try {
    if (clearOverrides) {
      const result = await clearManualOverridesForMatchInSupabase({ matchId, tournamentId });
      return NextResponse.json({ ok: true, ...result });
    }

    if (playerSlot) {
      const result = await recordManualPlayerSlotUpdate({
        matchId,
        slot: playerSlot,
        name,
        country,
        tournamentId,
        tournamentInstanceId,
        createdByUserId
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await recordManualMatchUpdate({
      matchId,
      tournamentId,
      tournamentInstanceId,
      createdByUserId,
      winnerPlayerId,
      scoreSummary,
      status
    });
    const scoring = await recalculateTournamentScoresInSupabase(result.match.tournament_id);

    return NextResponse.json({ ok: true, ...result, scoring });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not update match." }, { status: 500 });
  }
}
