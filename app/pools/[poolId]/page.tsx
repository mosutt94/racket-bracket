"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { PoolNav } from "@/components/PoolNav";
import { StatusBadge } from "@/components/StatusBadge";
import { getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { getLeaderboard } from "@/lib/services/scoring-service";
import { findTournamentForPool } from "@/lib/state-helpers";
import { useAutoSync } from "@/lib/use-auto-sync";
import type { AppState } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function PoolHomePage({ params }: { params: { poolId: string } }) {
  const [state, setState] = useState<AppState | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    loadAppState().then(setState);
  }, []);

  const tournament = state ? findTournamentForPool(state, params.poolId) : undefined;
  useAutoSync(tournament, {
    onSynced: async () => setState(await loadAppState())
  });

  if (!state) return null;
  const pool = state.pools.find((item) => item.id === params.poolId);
  if (!pool || !tournament) return <AppFrame><main className="p-8">Bracket not found.</main></AppFrame>;

  const leaderboard = getLeaderboard(state, pool.id, tournament.id);
  const user = getCurrentUserForState(state);
  const userBracket = state.brackets.find((item) => item.poolId === pool.id && item.tournamentId === tournament.id && item.userId === user.id);
  const inviteCode = pool.inviteCode;
  const inviteLink = `${origin || ""}/join/${inviteCode}`;

  async function copyInviteLink() {
    await copyText(`${window.location.origin}/join/${inviteCode}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <PoolNav poolId={pool.id} />
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-xl border border-court-200 bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-wide text-court-700">{pool.inviteCode}</p>
                <h1 className="text-3xl font-black text-ink">{pool.name}</h1>
              </div>
              <StatusBadge status={tournament.status} />
            </div>
            <p className="mt-4 text-slate-600">{tournament.name}</p>
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-court-50 p-4">
                <dt className="text-xs font-bold uppercase text-court-700">Draw</dt>
                <dd className="mt-1 text-2xl font-black">{tournament.bracketSize}</dd>
              </div>
              <div className="rounded-lg bg-court-50 p-4">
                <dt className="text-xs font-bold uppercase text-court-700">Deadline</dt>
                <dd className="mt-1 text-sm font-bold">{formatDateTime(tournament.pickingDeadline)}</dd>
              </div>
              <div className="rounded-lg bg-court-50 p-4">
                <dt className="text-xs font-bold uppercase text-court-700">My bracket</dt>
                <dd className="mt-1 text-sm font-bold">{userBracket?.status ?? "not started"}</dd>
              </div>
            </dl>
            <div className="mt-6 rounded-lg bg-court-50 p-3">
              <p className="text-xs font-bold uppercase text-court-700">Invite link</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-sm font-semibold text-court-900">{inviteLink}</p>
                <button onClick={copyInviteLink} className="inline-flex items-center justify-center gap-2 rounded-lg bg-court-700 px-3 py-2 text-sm font-bold text-white hover:bg-court-900">
                  <Copy size={15} /> {copied ? "Copied" : "Copy link"}
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/pools/${pool.id}/my-bracket`} className="rounded-lg bg-court-700 px-4 py-2 font-bold text-white">
                Make picks
              </Link>
              <Link href={`/pools/${pool.id}/leaderboard`} className="rounded-lg border border-court-200 bg-white px-4 py-2 font-bold text-court-800">
                Leaderboard
              </Link>
            </div>
          </section>
          <section className="rounded-xl border border-court-200 bg-white p-6 shadow-soft">
            <h2 className="text-lg font-black">Top standings</h2>
            <div className="mt-4 space-y-3">
              {leaderboard.slice(0, 5).map((row, index) => (
                <div key={row.userId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-semibold">{index + 1}. {row.displayName}</span>
                  <span className="font-black text-court-700">{row.score}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </AppFrame>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
