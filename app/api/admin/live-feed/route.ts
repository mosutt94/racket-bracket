import { NextResponse } from "next/server";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { TennisApiProvider } from "@/lib/providers/tennis-api-provider";
import { isSupabaseConfigured, recordLiveScoreSnapshot } from "@/lib/supabase/persistence";
import type { Gender, SlamType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slamType = (url.searchParams.get("slamType") ?? "french_open") as SlamType;
  const gender = (url.searchParams.get("gender") ?? "men") as Gender;
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  const providerName = url.searchParams.get("provider") ?? "espn";
  const tournamentId = url.searchParams.get("tournamentId");

  if (providerName === "espn") {
    const provider = new EspnTennisProvider();

    try {
      const preview = await provider.previewGrandSlam({
        slamType,
        year,
        dateRange: url.searchParams.get("dates") ?? undefined
      });
      const rawSnapshotId = tournamentId && isSupabaseConfigured()
        ? await recordLiveScoreSnapshot({
            tournamentId,
            providerName: preview.providerName,
            rawPayload: preview.rawPayload
          })
        : null;

      return NextResponse.json({
        ok: preview.sources.some((source) => source.ok),
        provider: "espn",
        health: {
          ok: preview.sources.some((source) => source.ok),
          providerName: preview.providerName,
          message: "ESPN feed checked. This provider is experimental and unofficial.",
          checkedAt: preview.checkedAt
        },
        preview: {
          ...preview,
          rawSnapshotId,
          rawPayload: undefined
        }
      });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        provider: "espn",
        health: {
          ok: false,
          providerName: "EspnTennisProvider",
          message: error instanceof Error ? error.message : "Could not preview ESPN live feed.",
          checkedAt: new Date().toISOString()
        },
        preview: null,
        error: error instanceof Error ? error.message : "Could not preview ESPN live feed."
      }, { status: 502 });
    }
  }

  const provider = new TennisApiProvider();

  const health = await provider.getProviderHealth();
  if (!health.ok) {
    return NextResponse.json({ ok: false, health, preview: null });
  }

  try {
    const preview = await provider.previewGrandSlam(slamType, year, gender);
    return NextResponse.json({ ok: true, health, preview });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      health,
      preview: null,
      error: error instanceof Error ? error.message : "Could not preview live feed."
    }, { status: 502 });
  }
}
