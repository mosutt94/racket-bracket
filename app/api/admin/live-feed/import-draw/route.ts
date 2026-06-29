import { NextResponse } from "next/server";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { buildEspnMappingPreview } from "@/lib/services/espn-mapping-service";
import {
  getAppStateFromSupabase,
  importEspnDrawInSupabase,
  isSupabaseConfigured,
  isTournamentPickingClosedInSupabase,
  refreshDrawSeedsInSupabase,
  tournamentHasPicksInSupabase
} from "@/lib/supabase/persistence";
import { requireCommissionerForTournament } from "@/lib/auth/guard";
import type { Gender, SlamType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ESPN draw import requires Supabase." }, { status: 400 });
  }

  const { tournamentId, slamType = "french_open", year = new Date().getFullYear(), gender = "men", resetExistingPicks = false } = await request.json() as {
    tournamentId?: string;
    slamType?: SlamType;
    year?: number;
    gender?: Gender;
    resetExistingPicks?: boolean;
  };

  if (!tournamentId) {
    return NextResponse.json({ ok: false, error: "tournamentId is required." }, { status: 400 });
  }

  // Destructive (can reset existing picks) — gate firmly to the commissioner.
  const guard = await requireCommissionerForTournament(tournamentId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  // Clearing all picks wipes every pool on this shared Slam. Never allow it once
  // play has begun — that would nuke a live tournament for everyone. (The safe,
  // pick-preserving seed refresh below stays available.)
  if (resetExistingPicks && (await isTournamentPickingClosedInSupabase(tournamentId))) {
    return NextResponse.json(
      { ok: false, error: "Clearing all picks is locked once the tournament has started." },
      { status: 403 }
    );
  }

  try {
    const provider = new EspnTennisProvider();
    const draw = await provider.getDrawImportData({ slamType, year, gender });

    // If picks already exist and we're not deliberately replacing the draw,
    // don't wipe them — just pull in the latest seeds (ESPN attaches the 32
    // seeds shortly after publishing the names). Non-destructive.
    if (!resetExistingPicks && (await tournamentHasPicksInSupabase(tournamentId))) {
      const seedResult = await refreshDrawSeedsInSupabase({ tournamentId, draw });
      return NextResponse.json({ ok: true, mode: "seeds", seedsUpdated: seedResult.seedsUpdated });
    }

    const result = await importEspnDrawInSupabase({ tournamentId, draw, resetExistingPicks });
    let mapping = null;
    let mappingWarning = null;

    try {
      const nextState = await getAppStateFromSupabase();
      const providerMatches = await provider.getPreviewMatches({ slamType, year });
      mapping = buildEspnMappingPreview(nextState, tournamentId, providerMatches);
    } catch (error) {
      mappingWarning = error instanceof Error ? error.message : "Imported draw, but could not refresh mapping preview.";
    }

    return NextResponse.json({
      ok: true,
      mode: resetExistingPicks ? "replaced" : "imported",
      result,
      mapping,
      warning: mappingWarning
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not import ESPN draw."
    }, { status: 500 });
  }
}
