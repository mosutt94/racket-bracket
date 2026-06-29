"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { BracketBoard } from "@/components/BracketBoard";
import { PageLoading } from "@/components/PageLoading";
import { PoolNav } from "@/components/PoolNav";
import { getCachedAppState, isPoolCommissioner, loadAppState } from "@/lib/app-state-client";
import { getSlamShortLabel } from "@/lib/services/bracket-shell-service";
import { effectivePoolRounds, findTournamentForPool, isPoolPickingClosed } from "@/lib/state-helpers";
import type { AppState } from "@/lib/types";

export default function MemberBracketPage({ params }: { params: { poolId: string; userId: string } }) {
  const [state, setState] = useState<AppState | null>(() => getCachedAppState(params.poolId));
  useEffect(() => {
    loadAppState(params.poolId).then(setState);
  }, [params.poolId]);

  if (!state) return <PageLoading />;
  const tournament = findTournamentForPool(state, params.poolId);
  if (!tournament) return null;

  const profile = state.profiles.find((item) => item.id === params.userId);
  const name = profile?.displayName ?? "Player";
  const memberBracket = state.brackets.find(
    (item) => item.poolId === params.poolId && item.tournamentId === tournament.id && item.userId === params.userId
  );
  const matches = state.matches.filter((match) => match.tournamentId === tournament.id);
  const rounds = effectivePoolRounds(state, params.poolId, tournament.id);
  const pickedCount = memberBracket
    ? state.bracketPicks.filter((pick) => pick.bracketId === memberBracket.id).length
    : 0;
  // Anti-copy: other members' brackets stay hidden until picking closes.
  const pickingClosed = isPoolPickingClosed(state, params.poolId);

  return (
    <AppFrame compact slam={tournament.slamType}>
      <main className="mx-auto max-w-none px-2 py-1 sm:px-3">
        <PoolNav poolId={params.poolId} compact showAccount isCommissioner={isPoolCommissioner(state, params.poolId)} />
        {!pickingClosed ? (
          <div className="rounded-xl border border-court-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-black text-ink">Brackets are hidden until picking closes</h1>
            <p className="mt-2 text-sm text-slate-600">You&apos;ll be able to see {name}&apos;s picks once the draw locks.</p>
          </div>
        ) : !memberBracket ? (
          <div className="rounded-xl border border-court-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-black text-ink">{name} hasn&apos;t entered a bracket</h1>
          </div>
        ) : (
          <BracketBoard
            bracketId={memberBracket.id}
            slamType={tournament.slamType}
            mode="review"
            locked
            title={`${name} · ${getSlamShortLabel(tournament.slamType, tournament.year, tournament.gender)}`}
            submitted={memberBracket.status !== "draft"}
            matches={matches}
            players={state.players}
            rounds={rounds}
            picks={state.bracketPicks}
            pickedCount={pickedCount}
            totalPicks={matches.length}
          />
        )}
      </main>
    </AppFrame>
  );
}
