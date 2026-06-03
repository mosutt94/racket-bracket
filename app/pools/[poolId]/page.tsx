"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoading } from "@/components/PageLoading";
import { loadAppState } from "@/lib/app-state-client";
import { findTournamentForPool } from "@/lib/state-helpers";

/**
 * The pool root is a thin entry point, not a page. Opening a bracket should drop
 * you straight into the thing you came to do: make picks while picking is open,
 * otherwise the leaderboard. The cross-bracket overview lives at /dashboard.
 */
export default function PoolEntryPage({ params }: { params: { poolId: string } }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    loadAppState(params.poolId).then((state) => {
      if (cancelled) return;
      const pool = state.pools.find((item) => item.id === params.poolId);
      if (!pool) {
        router.replace("/dashboard");
        return;
      }
      const tournament = findTournamentForPool(state, params.poolId);
      const target = tournament?.status === "picking_open" ? "my-bracket" : "leaderboard";
      router.replace(`/pools/${params.poolId}/${target}`);
    });
    return () => {
      cancelled = true;
    };
  }, [params.poolId, router]);

  return <PageLoading />;
}
