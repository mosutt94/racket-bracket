"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, UserRound } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";
import { saveCurrentUser } from "@/lib/current-user";
import type { Pool, Profile } from "@/lib/types";

export default function InviteJoinPage({ params }: { params: { inviteCode: string } }) {
  const router = useRouter();
  const inviteCode = params.inviteCode.toUpperCase();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function join() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/join-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, email, displayName })
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; pool?: Pool; profile?: Profile };
      if (!response.ok || !result.pool || !result.profile) throw new Error(result.error ?? "Could not join bracket.");

      saveCurrentUser(result.profile);
      router.push(`/pools/${result.pool.id}/my-bracket`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join bracket.");
      setBusy(false);
    }
  }

  return (
    <AppFrame>
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-xl border border-court-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-black uppercase tracking-wide text-court-700">Bracket invite</p>
          <h1 className="mt-2 text-3xl font-black text-ink">Join Racket Bracket</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Enter your email and display name, then make your picks. Invite code <span className="font-black text-ink">{inviteCode}</span>.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <Mail size={18} className="text-slate-400" />
                <input
                  className="min-w-0 flex-1 outline-none"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </span>
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Display name
              <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <UserRound size={18} className="text-slate-400" />
                <input
                  className="min-w-0 flex-1 outline-none"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Morris"
                />
              </span>
            </label>
          </div>

          {error ? <p className="mt-4 rounded-lg bg-clay-50 px-3 py-2 text-sm font-semibold text-clay-700">{error}</p> : null}

          <button
            onClick={join}
            disabled={busy || !email.trim() || !displayName.trim()}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Joining..." : "Join and make picks"} <ArrowRight size={18} />
          </button>
        </section>
      </main>
    </AppFrame>
  );
}
