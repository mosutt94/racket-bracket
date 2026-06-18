"use client";

import Link from "next/link";
import { ArrowRight, Check, Copy, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { PageLoading } from "@/components/PageLoading";
import { getCachedDashboardState, getCurrentUserForState, loadDashboardState } from "@/lib/app-state-client";
import { getSavedCurrentUser } from "@/lib/current-user";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, Profile } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(getCachedDashboardState);
  const [user, setUser] = useState<Profile | null>(() => {
    const cached = getCachedDashboardState();
    return cached && getSavedCurrentUser() ? getCurrentUserForState(cached) : null;
  });
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [tab, setTab] = useState<"active" | "history">("active");

  useEffect(() => {
    setOrigin(window.location.origin);
    const saved = getSavedCurrentUser();
    if (!saved) {
      router.replace("/auth");
      return;
    }

    loadDashboardState(saved.id).then((loaded) => {
      setState(loaded);
      setUser(getCurrentUserForState(loaded));
    });
  }, [router]);

  if (!state || !user) return <PageLoading />;
  const memberships = state.poolMembers.filter((member) => member.userId === user.id);
  const brackets = state.pools.filter((pool) => memberships.some((member) => member.poolId === pool.id));

  // A bracket moves into History a few days after its Slam wraps, so the final
  // standings linger on the main view briefly before being filed away.
  const HISTORY_AFTER_DAYS = 5;
  const isHistoryPool = (poolId: string) => {
    const completedAt = findTournamentForPool(state, poolId)?.completedAt;
    if (!completedAt) return false;
    return Date.now() - new Date(completedAt).getTime() >= HISTORY_AFTER_DAYS * 24 * 60 * 60 * 1000;
  };
  const activeBrackets = brackets.filter((pool) => !isHistoryPool(pool.id));
  const historyBrackets = brackets.filter((pool) => isHistoryPool(pool.id));
  const hasHistory = historyBrackets.length > 0;
  // No point showing tabs until there's anything in History.
  const shown = !hasHistory ? brackets : tab === "history" ? historyBrackets : activeBrackets;

  async function copyInviteLink(inviteCode: string) {
    const inviteLink = `${window.location.origin}/join/${inviteCode}`;
    await copyText(inviteLink);
    setCopiedInviteCode(inviteCode);
    window.setTimeout(() => setCopiedInviteCode(null), 1600);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-court-700">Racket Bracket</p>
            <h1 className="text-2xl font-black text-ink sm:text-3xl">Your brackets</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">Signed in as {user.displayName} · {user.email}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/pools/create" className="inline-flex items-center gap-2 rounded-lg bg-court-700 px-4 py-2 font-bold text-white">
              <Plus size={18} /> Create bracket
            </Link>
          </div>
        </div>
        {hasHistory ? (
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setTab("active")}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${tab === "active" ? "border-court-700 bg-court-700 text-white" : "border-court-200 bg-white text-slate-700 hover:border-court-300 hover:text-court-700"}`}
            >
              Active ({activeBrackets.length})
            </button>
            <button
              onClick={() => setTab("history")}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${tab === "history" ? "border-court-700 bg-court-700 text-white" : "border-court-200 bg-white text-slate-700 hover:border-court-300 hover:text-court-700"}`}
            >
              History ({historyBrackets.length})
            </button>
          </div>
        ) : null}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {shown.length > 0 ? shown.map((pool) => {
            const tournament = findTournamentForPool(state, pool.id);
            const done = isHistoryPool(pool.id);
            return (
              <article key={pool.id} className="min-w-0 rounded-xl border-2 border-court-200 bg-white p-5 shadow-soft transition hover:border-court-500 hover:shadow-lg">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-court-700">Invite {pool.inviteCode}</p>
                  {done ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-court-100 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-court-700">
                      <Check size={12} /> Completed
                    </span>
                  ) : null}
                </div>
                <Link href={`/pools/${pool.id}`} className="mt-2 block text-2xl font-black text-ink hover:text-court-700">{pool.name}</Link>
                <p className="mt-1 text-sm text-slate-600">{tournament?.name ?? "No active tournament"}</p>
                <Link
                  href={`/pools/${pool.id}`}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 sm:w-auto"
                >
                  Open bracket <ArrowRight size={16} />
                </Link>
                <div className="mt-4 rounded-lg border border-court-200 bg-court-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-court-700">Invite link</p>
                  <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 truncate text-sm font-semibold text-court-900">{origin ? `${origin}/join/${pool.inviteCode}` : `/join/${pool.inviteCode}`}</p>
                    <button
                      onClick={() => copyInviteLink(pool.inviteCode)}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-court-200 bg-white px-3 py-2 text-sm font-bold text-court-800 hover:bg-court-100"
                    >
                      <Copy size={15} /> {copiedInviteCode === pool.inviteCode ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </div>
              </article>
            );
          }) : hasHistory ? (
            <div className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-ink">No active brackets</h2>
              <p className="mt-2 text-sm text-slate-600">Your finished brackets are in History. Create a new one to get back in the game.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-court-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-ink">No brackets yet</h2>
              <p className="mt-2 text-sm text-slate-600">Create a bracket or join one with an invite code.</p>
            </div>
          )}
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
