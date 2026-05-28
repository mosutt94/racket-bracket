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
  tournament: Pick<Tournament, "id" | "tournamentInstanceId"> | undefined | null,
  options: { staleMinutes?: number; onSynced?: () => void | Promise<void> } = {}
) {
  const staleMinutes = options.staleMinutes ?? 10;

  useEffect(() => {
    if (!tournament?.id || !tournament.tournamentInstanceId) return;
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
        // result.skipped === true means another request already synced recently.
        if (result.ok && !result.skipped) {
          await options.onSynced?.();
        }
      } catch {
        // Background sync — never surface errors to the user.
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // Intentional dep list: re-run only when the tournament identity changes,
    // not on every render of the parent (which would happen if we depended on
    // the full `tournament` object since its reference changes per render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id, tournament?.tournamentInstanceId, staleMinutes]);
}
