import { NextResponse } from "next/server";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { initialState } from "@/lib/seed";
import { buildEspnMappingPreview } from "@/lib/services/espn-mapping-service";
import { getAppStateFromSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";
import type { SlamType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournamentId");
  const slamType = (url.searchParams.get("slamType") ?? "french_open") as SlamType;
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

  if (!tournamentId) {
    return NextResponse.json({ ok: false, error: "tournamentId is required." }, { status: 400 });
  }

  try {
    const state = isSupabaseConfigured() ? await getAppStateFromSupabase() : initialState;
    const provider = new EspnTennisProvider();
    const providerMatches = await provider.getPreviewMatches({ slamType, year, dateRange: url.searchParams.get("dates") ?? undefined });
    const preview = buildEspnMappingPreview(state, tournamentId, providerMatches);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Could not build ESPN mapping preview."
    }, { status: 502 });
  }
}
