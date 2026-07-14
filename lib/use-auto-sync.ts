"use client";

import { useEffect } from "react";
import type { Tournament } from "@/lib/types";

/**
 * Triggers a server-side ESPN sync when the page mounts, but only if the
 * tournament hasn't been synced within `staleMinutes` — so concurrent page
 * loads don't hammer ESPN. On success, calls `onSynced` so the page can
 * reload state and show the freshly-applied scores.
 *
 * Fire-and-forget: the page renders immediately with whatever state it
 * already had; the user just sees newer numbers a few seconds later.
 */
export function useAutoSync(
  tournament: Pick<Tournament, "id" | "tournamentInstanceId" | "status"> | undefined | null,
  options: { staleMinutes?: number; intervalMs?: number; onSynced?: () => void | Promise<void> } = {}
) {
  const staleMinutes = options.staleMinutes ?? 10;
  // When set, keep re-checking on this cadence so a viewer watching a live match
  // sees scores/statuses update without navigating. The server call is
  // stale-gated (ifStaleMinutes), so repeated ticks are cheap no-ops when fresh.
  const intervalMs = options.intervalMs ?? 0;

  useEffect(() => {
    if (!tournament?.id || !tournament.tournamentInstanceId) return;
    // A concluded Slam never changes — don't poll it at all.
    if (tournament.status === "completed") return;
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch("/api/admin/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tournamentId: tournament!.id,
            tournamentInstanceId: tournament!.tournamentInstanceId,
            syncType: "auto",
            ifStaleMinutes: staleMinutes
          })
        });
        if (!response.ok || cancelled) return;
        const result = await response.json();
        if (cancelled) return;
        // Fire on every tick, not just when THIS request ran the sync — another
        // viewer's request may have refreshed the data, and the handler's delta
        // fetch is a few KB (a no-op when nothing changed).
        if (result.ok) {
          await options.onSynced?.();
        }
      } catch {
        // Background sync — never surface errors to the user.
      }
    }

    run();
    const timer = intervalMs > 0 ? setInterval(run, intervalMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // Intentional dep list: re-run only when the tournament identity/status
    // changes, not on every render of the parent (which would happen if we
    // depended on the full `tournament` object — its reference changes per render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id, tournament?.tournamentInstanceId, tournament?.status, staleMinutes, intervalMs]);
}
