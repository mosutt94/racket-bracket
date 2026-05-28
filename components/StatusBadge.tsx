import type { BracketStatus, MatchStatus, TournamentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  setup: "bg-slate-100 text-slate-700",
  picking_open: "bg-court-100 text-court-900",
  locked: "bg-amber-100 text-amber-800",
  in_progress: "bg-ball text-court-900",
  completed: "bg-court-900 text-white",
  scheduled: "bg-slate-100 text-slate-700",
  live: "bg-ball text-court-900",
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-court-100 text-court-900"
};

export function StatusBadge({ status }: { status: TournamentStatus | MatchStatus | BracketStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tone[status])}>
      {status.replace("_", " ")}
    </span>
  );
}
