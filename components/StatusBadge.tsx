import type { BracketStatus, MatchStatus, TournamentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<string, string> = {
  setup: "bg-slate-100 text-slate-700",
  picking_open: "bg-court-100 text-court-900",
  locked: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-ink text-white",
  scheduled: "bg-slate-100 text-slate-700",
  live: "bg-clay-100 text-clay-700",
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
