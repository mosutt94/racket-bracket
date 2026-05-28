import { NextResponse } from "next/server";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { buildEspnMappingPreview } from "@/lib/services/espn-mapping-service";
import { getAppStateFromSupabase, importEspnDrawInSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";
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

  try {
    const provider = new EspnTennisProvider();
    const draw = await provider.getDrawImportData({ slamType, year, gender });
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
