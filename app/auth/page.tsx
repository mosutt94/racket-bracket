"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { PasswordField } from "@/components/PasswordField";
import { saveCurrentUser } from "@/lib/current-user";

export default function AuthPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password" | "name">("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submitEmail() {
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error ?? "Could not sign in.");
        return;
      }
      // Protected (commissioner) account — verify the password before signing in.
      if (result.needsPassword) {
        setStep("password");
        return;
      }
      if (result.profile) {
        saveCurrentUser(result.profile);
        router.push("/dashboard");
        return;
      }
      // New email — ask for a display name.
      setStep("name");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error ?? "That password doesn't match. Try again.");
        setPassword("");
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

  async function submitName() {
    if (!displayName.trim()) {
      setError("Enter a display name.");
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
        setError(result.error ?? "Could not create your profile.");
        return;
      }
      saveCurrentUser(result.profile);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your profile.");
    } finally {
      setBusy(false);
    }
  }

  const errorBox = error ? (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>
  ) : null;

  return (
    <AppFrame>
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-lg items-center px-4 py-10">
        <div className="w-full rounded-xl border border-court-200 bg-white p-6 shadow-soft">
          {step === "email" ? (
            <>
              <h1 className="text-2xl font-black text-ink">Sign in</h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter the email you joined with to see your brackets and the leaderboard. New here? We&apos;ll get you set up in one more step.
              </p>
              <div className="mt-6 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    autoFocus
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && submitEmail()}
                  />
                </label>
                {errorBox}
                <button onClick={submitEmail} disabled={busy} className="w-full rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:bg-slate-300">
                  {busy ? "Checking..." : "Continue"}
                </button>
              </div>
            </>
          ) : step === "password" ? (
            <>
              <h1 className="text-2xl font-black text-ink">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-600">
                This commissioner account is protected. Enter your password to sign in.
              </p>
              <div className="mt-6 space-y-4">
                <PasswordField label="Commissioner password" autoFocus value={password} onChange={setPassword} onEnter={submitPassword} />
                {errorBox}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStep("email");
                      setPassword("");
                      setError("");
                    }}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-4 py-3 font-bold text-slate-600 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button onClick={submitPassword} disabled={busy} className="flex-1 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:bg-slate-300">
                    {busy ? "Signing in..." : "Sign in"}
                  </button>
                </div>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-semibold hover:text-court-700">Forgot your password?</summary>
                  <p className="mt-2 leading-5">
                    There&apos;s no automatic reset yet. Message whoever set up Racket Bracket and they can clear your
                    password so you can set a new one. Your brackets and members are safe — only the password resets.
                  </p>
                </details>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-ink">Welcome — let&apos;s set you up</h1>
              <p className="mt-2 text-sm text-slate-600">
                Looks like you&apos;re new. What name should appear on your brackets?
              </p>
              <div className="mt-6 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Display name
                  <input
                    autoFocus
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && submitName()}
                  />
                </label>
                <p className="text-xs font-semibold text-slate-500">Signing up as {email}</p>
                {errorBox}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setStep("email");
                      setError("");
                    }}
                    disabled={busy}
                    className="rounded-lg border border-slate-200 px-4 py-3 font-bold text-slate-600 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button onClick={submitName} disabled={busy} className="flex-1 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:bg-slate-300">
                    {busy ? "Creating..." : "Create profile"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </AppFrame>
  );
}
