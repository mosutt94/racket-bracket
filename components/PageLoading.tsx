import { Trophy } from "lucide-react";

/**
 * Branded full-screen loading state. Shown wherever a page is still fetching its
 * data, so a cold load reads as "loading" instead of a blank white screen that
 * looks broken — important for first-time, submit-once users.
 *
 * Everything here is vector (the lucide SVG) or CSS (the border spinner), so the
 * sm+ size bump for larger screens stays perfectly crisp.
 */
export function PageLoading() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#eef2ee] px-6 sm:gap-6">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ball text-court-900 sm:h-20 sm:w-20">
        <Trophy className="h-6 w-6 sm:h-10 sm:w-10" />
      </span>
      <p className="text-xs font-black uppercase tracking-wide text-court-700 sm:text-base">Racket Bracket</p>
      <span
        className="h-6 w-6 animate-spin rounded-full border-2 border-court-200 border-t-court-700 sm:h-10 sm:w-10 sm:border-[3px]"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
