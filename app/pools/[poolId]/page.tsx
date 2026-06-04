"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoading } from "@/components/PageLoading";
import { loadAppState } from "@/lib/app-state-client";

/**
 * The pool root is a thin entry point, not a page. Opening a bracket drops you
 * into your own bracket — make picks while picking is open, or review your picks
 * and live scoring once it's locked. The cross-bracket overview lives at
 * /dashboard; everything else is one tap away in the nav.
 */
export default function PoolEntryPage({ params }: { params: { poolId: string } }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    loadAppState(params.poolId).then((state) => {
      if (cancelled) return;
      const pool = state.pools.find((item) => item.id === params.poolId);
      router.replace(pool ? `/pools/${params.poolId}/my-bracket` : "/dashboard");
    });
    return () => {
      cancelled = true;
    };
  }, [params.poolId, router]);

  return <PageLoading />;
}
