"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { saveCurrentUser } from "@/lib/current-user";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (!email.trim() || !displayName.trim()) {
      setError("Email and display name are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Could not sign in.");
        return;
      }
      saveCurrentUser(result.profile);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
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
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
            <button onClick={signIn} disabled={busy} className="w-full rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:bg-slate-300">
              {busy ? "Signing in..." : "Continue"}
            </button>
          </div>
        </div>
      </main>
    </AppFrame>
  );
}
