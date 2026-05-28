import { NextResponse } from "next/server";
import { initialState } from "@/lib/seed";
import { EspnTennisProvider } from "@/lib/providers/espn-tennis-provider";
import { getAppStateFromSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";
import type { AppState, BracketLiveScore, ProviderEventType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournamentId");
  if (!tournamentId) {
    return NextResponse.json({ ok: false, error: "Missing tournamentId." }, { status: 400 });
  }

  try {
    const state = await loadState();
    const tournament = state.tournaments.find((item) => item.id === tournamentId);
    if (!tournament) {
      return NextResponse.json({ ok: false, error: "Tournament not found." }, { status: 404 });
    }

    const internalMatches = state.matches.filter((match) => match.tournamentId === tournament.id && match.externalProviderMatchId);
    const internalByProviderId = new Map(internalMatches.map((match) => [normalizeEspnMatchId(match.externalProviderMatchId ?? ""), match]));
    const provider = new EspnTennisProvider();
    const checkedAt = new Date().toISOString();
    const eventType: ProviderEventType = tournament.gender === "women" ? "womens_singles" : "mens_singles";
    const providerMatches = await provider.getPreviewMatches({
      slamType: tournament.slamType,
      year: tournament.year
    });

    const scores: BracketLiveScore[] = providerMatches
      .filter((match) => match.eventType === eventType)
      .flatMap((providerMatch) => {
        const externalProviderMatchId = normalizeEspnMatchId(providerMatch.providerMatchId);
        const internalMatch = internalByProviderId.get(externalProviderMatchId);
        if (!internalMatch) return [];
        return [{
          matchId: internalMatch.id,
          externalProviderMatchId,
          status: providerMatch.status,
          scoreSummary: providerMatch.scoreSummary ?? null,
          player1Linescores: providerMatch.player1Linescores,
          player2Linescores: providerMatch.player2Linescores,
          checkedAt
        }];
      });

    return NextResponse.json({
      ok: true,
      provider: "espn",
      experimental: true,
      checkedAt,
      scores
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      provider: "espn",
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Could not load ESPN live scores."
    }, { status: 502 });
  }
}

async function loadState(): Promise<AppState> {
  if (!isSupabaseConfigured()) return initialState;
  return getAppStateFromSupabase();
}

function normalizeEspnMatchId(matchId: string) {
  return matchId.startsWith("espn-match-") ? matchId : `espn-match-${matchId}`;
}
