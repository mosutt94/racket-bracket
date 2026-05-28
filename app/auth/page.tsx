"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { createDemoProfile, ensureProfile, loadState, saveCurrentUser, saveState } from "@/lib/demo-store";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@racketbracket.app");
  const [displayName, setDisplayName] = useState("Demo Captain");

  function signIn() {
    const profile = createDemoProfile(email, displayName);
    const state = ensureProfile(loadState(), profile);
    saveCurrentUser(profile);
    saveState(state);
    router.push("/dashboard");
  }

  return (
    <AppFrame>
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-lg items-center px-4 py-10">
        <div className="w-full rounded-xl border border-court-100 bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-black text-ink">Commissioner sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Use the email and name you want attached to the brackets you create.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Display name
              <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <button onClick={signIn} className="w-full rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900">
              Continue
            </button>
          </div>
        </div>
      </main>
    </AppFrame>
  );
}
