import { NextResponse } from "next/server";
import {
  clearManualOverridesForMatchInSupabase,
  isSupabaseConfigured,
  recalculateTournamentScoresInSupabase,
  recordManualMatchUpdate,
  recordManualPlayerSlotUpdate
} from "@/lib/supabase/persistence";
import { requireCommissionerForTournament } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { matchId, winnerPlayerId, scoreSummary, tournamentId, tournamentInstanceId, status, playerSlot, name, country, clearOverrides } = await request.json();

  if (!matchId) {
    return NextResponse.json({ ok: false, error: "matchId is required." }, { status: 400 });
  }
  if (!clearOverrides && !tournamentInstanceId) {
    return NextResponse.json(
      { ok: false, error: "tournamentInstanceId is required for manual updates." },
      { status: 400 }
    );
  }

  // Only the commissioner of a pool in this draw may edit matches. The acting
  // user is taken from the verified cookie, never trusted from the request body.
  const guard = await requireCommissionerForTournament(tournamentId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const createdByUserId = guard.userId;

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
