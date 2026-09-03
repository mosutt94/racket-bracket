import { NextResponse } from "next/server";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { buildEspnMappingPreview } from "@/lib/services/espn-mapping-service";
import {
  getAppStateFromSupabase,
  importEspnDrawInSupabase,
  isDrawPublishedInSupabase,
  isSupabaseConfigured,
  isTournamentPickingClosedInSupabase,
  refreshDrawSeedsInSupabase,
  tournamentHasPicksInSupabase
} from "@/lib/supabase/persistence";
import { requireSiteOwner } from "@/lib/auth/guard";
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
  const guard = await requireSiteOwner(tournamentId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  // Draw import touches the shared per-Slam tournament. Freeze it once play has
  // begun: the destructive clear-all would nuke a live tournament for everyone,
  // and the safe seed refresh is pointless after the draw is set.
  //
  // But "picking closed" is not the same as "the draw is in". ESPN publishes a
  // Slam draw only a few days before round 1, so picking can close (deadline
  // passed, or the commissioner deliberately closed it to stop people picking a
  // placeholder bracket) while all 128 slots still read "TBD" — and freezing on
  // that would lock the commissioner out of ever importing the real draw, leaving
  // the Slam permanently unplayable. While the draw is still unpublished there is
  // nothing to protect, so the import stays available.
  //
  // Once play has begun only the DESTRUCTIVE paths freeze: the explicit clear-all,
  // and a full import (which is what runs when no picks exist yet). The
  // pick-preserving refresh below stays available all tournament — it's how
  // late seeds, resolved qualifiers, and pre-R1 withdrawal replacements
  // ("A. Gea (Was Ruud)") get into a draw people have already picked.
  const hasPicks = await tournamentHasPicksInSupabase(tournamentId);
  const started = (await isTournamentPickingClosedInSupabase(tournamentId)) && (await isDrawPublishedInSupabase(tournamentId));
  if (started && (resetExistingPicks || !hasPicks)) {
    return NextResponse.json(
      { ok: false, error: "Re-importing the draw is locked once the tournament has started." },
      { status: 403 }
    );
  }

  try {
    const provider = new EspnTennisProvider();
    const draw = await provider.getDrawImportData({ slamType, year, gender });

    // If picks already exist and we're not deliberately replacing the draw,
    // don't wipe them — refresh in place: seeds, qualifier names, withdrawal
    // replacements. Non-destructive; every pick keeps pointing at its slot.
    if (!resetExistingPicks && hasPicks) {
      const seedResult = await refreshDrawSeedsInSupabase({ tournamentId, draw });
      return NextResponse.json({ ok: true, mode: "seeds", seedsUpdated: seedResult.seedsUpdated, namesResolved: seedResult.namesResolved, replacementsApplied: seedResult.replacementsApplied });
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
