"use client";

import Link from "next/link";
import { Copy, Plus, Ticket } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { getSavedCurrentUser } from "@/lib/demo-store";
import { findTournamentForPool } from "@/lib/state-helpers";
import type { AppState, Profile } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    if (!getSavedCurrentUser()) {
      router.replace("/auth");
      return;
    }

    loadAppState().then((loaded) => {
      setState(loaded);
      setUser(getCurrentUserForState(loaded));
    });
  }, [router]);

  if (!state || !user) return null;
  const memberships = state.poolMembers.filter((member) => member.userId === user.id);
  const brackets = state.pools.filter((pool) => memberships.some((member) => member.poolId === pool.id));

  async function copyInviteLink(inviteCode: string) {
    const inviteLink = `${window.location.origin}/join/${inviteCode}`;
    await copyText(inviteLink);
    setCopiedInviteCode(inviteCode);
    window.setTimeout(() => setCopiedInviteCode(null), 1600);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-court-700">Commissioner</p>
            <h1 className="text-3xl font-black text-ink">Your brackets</h1>
            <p className="mt-1 text-sm font-semibold text-slate-600">Signed in as {user.displayName} · {user.email}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/pools/create" className="inline-flex items-center gap-2 rounded-lg bg-court-700 px-4 py-2 font-bold text-white">
              <Plus size={18} /> Create bracket
            </Link>
            <Link href="/pools/join" className="inline-flex items-center gap-2 rounded-lg border border-court-200 bg-white px-4 py-2 font-bold text-court-800">
              <Ticket size={18} /> Join
            </Link>
          </div>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {brackets.length > 0 ? brackets.map((pool) => {
            const tournament = findTournamentForPool(state, pool.id);
            return (
              <article key={pool.id} className="rounded-xl border border-court-100 bg-white p-5 shadow-sm hover:shadow-soft">
                <p className="text-xs font-bold uppercase tracking-wide text-clay-700">Invite {pool.inviteCode}</p>
                <Link href={`/pools/${pool.id}`} className="mt-2 block text-xl font-black text-ink hover:text-court-700">{pool.name}</Link>
                <p className="mt-2 text-sm text-slate-600">{tournament?.name ?? "No active tournament"}</p>
                <div className="mt-4 flex flex-col gap-2 rounded-lg bg-court-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="min-w-0 truncate text-sm font-semibold text-court-900">{origin ? `${origin}/join/${pool.inviteCode}` : `/join/${pool.inviteCode}`}</p>
                  <button
                    onClick={() => copyInviteLink(pool.inviteCode)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-court-700 px-3 py-2 text-sm font-bold text-white hover:bg-court-900"
                  >
                    <Copy size={15} /> {copiedInviteCode === pool.inviteCode ? "Copied" : "Copy link"}
                  </button>
                </div>
              </article>
            );
          }) : (
            <div className="rounded-xl border border-court-100 bg-white p-5 shadow-sm">
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
