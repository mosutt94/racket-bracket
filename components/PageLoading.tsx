import { Trophy } from "lucide-react";

/**
 * Branded full-screen loading state. Shown wherever a page is still fetching its
 * data, so a cold load reads as "loading" instead of a blank white screen that
 * looks broken — important for first-time, submit-once users.
 */
export function PageLoading() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#eef2ee] px-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ball text-court-900">
        <Trophy size={24} />
      </span>
      <p className="text-xs font-black uppercase tracking-wide text-court-700">Racket Bracket</p>
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-court-200 border-t-court-700"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
