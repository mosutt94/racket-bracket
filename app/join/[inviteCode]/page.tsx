"use client";

import { ArrowRight, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { PageLoading } from "@/components/PageLoading";
import { PasswordField } from "@/components/PasswordField";
import { loadDashboardState } from "@/lib/app-state-client";
import { clearCurrentUser, getSavedCurrentUser, saveCurrentUser } from "@/lib/current-user";

type Preview = { poolId: string; poolName: string; commissionerName: string | null; pickingClosed: boolean };
type Phase = "checking" | "invalid" | "closed" | "signed-in" | "email" | "password" | "name";

export default function InviteJoinPage({ params }: { params: { inviteCode: string } }) {
  const router = useRouter();
  const inviteCode = params.inviteCode.toUpperCase();

  const [phase, setPhase] = useState<Phase>("checking");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Resolve the invite, then route the visitor to the right flow:
  // already a member -> straight to their bracket; signed in -> one-tap join;
  // otherwise -> email-first join (which recognizes returning accounts).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let nextPreview: Preview;
      try {
        const response = await fetch(`/api/invite/${inviteCode}`, { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setPhase("invalid");
          return;
        }
        nextPreview = { poolId: data.poolId, poolName: data.poolName, commissionerName: data.commissionerName ?? null, pickingClosed: Boolean(data.pickingClosed) };
        setPreview(nextPreview);
      } catch {
        if (!cancelled) setPhase("invalid");
        return;
      }

      const saved = getSavedCurrentUser();
      if (!saved) {
        // Picking closed → show the closed screen up front (it has a "sign in to
        // your bracket" path for returning members). Otherwise, the email step.
        if (!cancelled) setPhase(nextPreview.pickingClosed ? "closed" : "email");
        return;
      }

      try {
        const userState = await loadDashboardState(saved.id);
        if (cancelled) return;
        if (userState.pools.some((pool) => pool.id === nextPreview.poolId)) {
          router.replace(`/pools/${nextPreview.poolId}/my-bracket`);
          return;
        }
      } catch {
        // Membership check failed — fall through to the one-tap join card.
      }
      if (cancelled) return;
      // Signed in but not a member, and picking has closed — no point offering a
      // join button that would just fail. (Returning members already redirected.)
      if (nextPreview.pickingClosed) {
        setPhase("closed");
        return;
      }
      setCurrentName(saved.displayName);
      setPhase("signed-in");
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteCode, router]);

  async function joinAndGo(userId: string) {
    const response = await fetch("/api/join-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode, userId })
    });
    const data = await response.json();
    // Latecomer after picks locked — show the friendly closed screen, not an error.
    if (data.closed) {
      setBusy(false);
      setPhase("closed");
      return;
    }
    if (!response.ok || !data.ok || !data.pool) throw new Error(data.error ?? "Could not join bracket.");
    router.replace(`/pools/${data.pool.id}/my-bracket`);
  }

  async function joinAsCurrentUser() {
    const saved = getSavedCurrentUser();
    if (!saved) {
      setPhase("email");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await joinAndGo(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not join bracket.");
      setBusy(false);
    }
  }

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
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not continue.");
      // Protected (commissioner) account — verify the password before joining.
      if (data.needsPassword) {
        setBusy(false);
        setPhase("password");
        return;
      }
      if (data.profile) {
        // Existing account — recognized by email, no duplicate created.
        saveCurrentUser(data.profile);
        await joinAndGo(data.profile.id);
        return;
      }
      setBusy(false);
      // Brand-new email after picks locked — block before asking for a name.
      setPhase(preview?.pickingClosed ? "closed" : "name");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
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
      const data = await response.json();
      if (!response.ok || !data.ok || !data.profile) {
        setError(data.error ?? "That password doesn't match. Try again.");
        setPassword("");
        setBusy(false);
        return;
      }
      saveCurrentUser(data.profile);
      await joinAndGo(data.profile.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
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
      const data = await response.json();
      if (!response.ok || !data.ok || !data.profile) throw new Error(data.error ?? "Could not create your profile.");
      saveCurrentUser(data.profile);
      await joinAndGo(data.profile.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create your profile.");
      setBusy(false);
    }
  }

  function useDifferentEmail() {
    clearCurrentUser();
    setCurrentName(null);
    setEmail("");
    setPassword("");
    setError("");
    setPhase("email");
  }

  if (phase === "checking") return <PageLoading />;

  const createdBy = preview?.commissionerName ? `Created by ${preview.commissionerName}` : null;
  const errorBox = error ? (
    <p className="mt-4 rounded-lg bg-clay-100 px-3 py-2 text-sm font-semibold text-clay-700">{error}</p>
  ) : null;

  return (
    <AppFrame>
      <main className="mx-auto flex min-h-[calc(100vh-65px)] max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-xl border border-court-200 bg-white p-6 shadow-soft">
          {phase === "invalid" ? (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-clay-700">Invite</p>
              <h1 className="mt-2 text-2xl font-black text-ink">This invite link isn&apos;t valid</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Double-check the link, or ask whoever invited you to send a fresh one.
              </p>
            </>
          ) : phase === "closed" ? (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-clay-700">Picking closed</p>
              <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">{preview?.poolName} has already started</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Picks locked when the tournament began, so this bracket isn&apos;t taking new entries.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Already made a bracket? Sign in with the email you used and you&apos;ll go straight to it.
              </p>
              <button
                onClick={useDifferentEmail}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900"
              >
                Sign in to your bracket <ArrowRight size={18} />
              </button>
              <a
                href="/dashboard"
                className="mt-3 block w-full text-center text-sm font-semibold text-slate-500 hover:text-court-700"
              >
                Go to my brackets
              </a>
            </>
          ) : phase === "signed-in" ? (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-court-700">You&apos;re invited 🎾</p>
              <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Join {preview?.poolName}</h1>
              {createdBy ? <p className="mt-1 text-sm font-semibold text-slate-600">{createdBy}</p> : null}
              <p className="mt-4 text-sm leading-6 text-slate-600">
                This is a new bracket. Tap below to join it
                {currentName ? (
                  <> — you&apos;re already signed in as <span className="font-bold text-ink">{currentName}</span></>
                ) : null}
                .
              </p>
              {errorBox}
              <button
                onClick={joinAsCurrentUser}
                disabled={busy}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:bg-slate-300"
              >
                {busy ? "Joining..." : "Join this bracket"} <ArrowRight size={18} />
              </button>
              <button
                onClick={useDifferentEmail}
                disabled={busy}
                className="mt-3 w-full text-center text-sm font-semibold text-slate-500 hover:text-court-700 disabled:opacity-50"
              >
                Not you? Use a different email
              </button>
            </>
          ) : phase === "email" ? (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-court-700">You&apos;re invited 🎾</p>
              <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Join {preview?.poolName}</h1>
              {createdBy ? <p className="mt-1 text-sm font-semibold text-slate-600">{createdBy}</p> : null}
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Enter your email to join. Played before? Use the same email and we&apos;ll log you into your existing
                bracket — no new account, nothing lost.
              </p>
              <label className="mt-5 block text-sm font-semibold text-slate-700">
                Email
                <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    className="min-w-0 flex-1 outline-none"
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && submitEmail()}
                    placeholder="you@example.com"
                  />
                </span>
              </label>
              {errorBox}
              <button
                onClick={submitEmail}
                disabled={busy || !email.trim()}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Checking..." : "Continue"} <ArrowRight size={18} />
              </button>
            </>
          ) : phase === "password" ? (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-court-700">You&apos;re invited 🎾</p>
              <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">Join {preview?.poolName}</h1>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                This account is protected — enter your password to join.
              </p>
              <div className="mt-5">
                <PasswordField label="Password" autoFocus value={password} onChange={setPassword} onEnter={submitPassword} />
              </div>
              {errorBox}
              <button
                onClick={submitPassword}
                disabled={busy || !password}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? "Joining..." : "Join this bracket"} <ArrowRight size={18} />
              </button>
              <button
                onClick={useDifferentEmail}
                disabled={busy}
                className="mt-3 w-full text-center text-sm font-semibold text-slate-500 hover:text-court-700 disabled:opacity-50"
              >
                Use a different email
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-black uppercase tracking-wide text-court-700">Almost there</p>
              <h1 className="mt-2 text-2xl font-black text-ink sm:text-3xl">What name should we show?</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This is how you&apos;ll appear on the {preview?.poolName} leaderboard.
              </p>
              <label className="mt-5 block text-sm font-semibold text-slate-700">
                Display name
                <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <UserRound size={18} className="text-slate-400" />
                  <input
                    className="min-w-0 flex-1 outline-none"
                    autoFocus
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && submitName()}
                    placeholder="Morris"
                  />
                </span>
              </label>
              <p className="mt-2 text-xs font-semibold text-slate-500">Signing up as {email}</p>
              {errorBox}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => {
                    setPhase("email");
                    setError("");
                  }}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-4 py-3 font-bold text-slate-600 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={submitName}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-court-700 px-4 py-3 font-bold text-white hover:bg-court-900 disabled:bg-slate-300"
                >
                  {busy ? "Joining..." : "Join and make picks"} <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </AppFrame>
  );
}
