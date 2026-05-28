import { NextResponse } from "next/server";
import { initialState } from "@/lib/seed";
import { recalculateScores } from "@/lib/services/scoring-service";
import {
  clearManualOverridesForMatchInSupabase,
  isSupabaseConfigured,
  recalculateTournamentScoresInSupabase,
  recordManualMatchUpdate,
  recordManualPlayerSlotUpdate
} from "@/lib/supabase/persistence";

export async function POST(request: Request) {
  const { matchId, winnerPlayerId, scoreSummary, tournamentId, tournamentInstanceId, createdByUserId, status, playerSlot, name, country, clearOverrides } = await request.json();

  if (!matchId) {
    return NextResponse.json({ ok: false, error: "matchId is required." }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    if (!clearOverrides && (!tournamentInstanceId || !createdByUserId)) {
      return NextResponse.json(
        { ok: false, error: "tournamentInstanceId and createdByUserId are required for Supabase-backed manual updates." },
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

  const match = initialState.matches.find((item) => item.id === matchId);
  if (!match) return NextResponse.json({ ok: false, error: "Match not found" }, { status: 404 });

  const withResult = {
    ...initialState,
    matches: initialState.matches.map((item) =>
      item.id === matchId
        ? {
            ...item,
            winnerPlayerId,
            scoreSummary: scoreSummary ?? "",
            status: winnerPlayerId ? "completed" as const : "scheduled" as const,
            updatedAt: new Date().toISOString()
          }
        : item
    )
  };
  const rescored = recalculateScores(withResult, match.tournamentId);
  return NextResponse.json({ ok: true, matchId, bracketsScored: rescored.brackets.length });
}
