"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";

export default function JoinPoolPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("CLAY26");

  function submit() {
    if (!inviteCode.trim()) return;
    router.push(`/join/${inviteCode.trim().toUpperCase()}`);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-xl border border-court-100 bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black">Join a private bracket</h1>
          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Invite code
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 uppercase" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
          </label>
          <button onClick={submit} className="mt-5 w-full rounded-lg bg-court-700 px-4 py-3 font-bold text-white">
            Continue
          </button>
        </div>
      </main>
    </AppFrame>
  );
}
