"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame } from "@/components/AppFrame";
import { PasswordField } from "@/components/PasswordField";
import { getCurrentUserForState, loadAppState } from "@/lib/app-state-client";
import { getSavedCurrentUser, saveCurrentUser } from "@/lib/current-user";
import { validatePassword } from "@/lib/password-rules";
import { getUpcomingSlam } from "@/lib/services/bracket-shell-service";
import type { Gender, Profile, SlamType } from "@/lib/types";

const SLAM_OPTIONS: Array<{ value: SlamType; label: string }> = [
  { value: "australian_open", label: "Australian Open" },
  { value: "french_open", label: "French Open" },
  { value: "wimbledon", label: "Wimbledon" },
  { value: "us_open", label: "US Open" }
];

export default function CreatePoolPage() {
  const router = useRouter();
  // Default to the current/upcoming Slam (date-aware) instead of a fixed one.
  const upcoming = getUpcomingSlam();
  const [name, setName] = useState("Sunday Slam Club");
  const [slamType, setSlamType] = useState<SlamType>(upcoming.slamType);
  const [gender, setGender] = useState<Gender>("men");
  const [year, setYear] = useState<number>(upcoming.year);
  const [user, setUser] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);

  // The creator becomes a commissioner, so they must end up with a password.
  // Skip the fields if they already have one (already a commissioner elsewhere).
  const needsPassword = user ? !user.hasPassword : false;
  const passwordValidationError = password ? validatePassword(password) : null;
  const passwordsMatch = password === confirmPassword;
  const passwordReady = !needsPassword || (validatePassword(password) === null && passwordsMatch);

  useEffect(() => {
    if (!getSavedCurrentUser()) {
      router.replace("/auth");
      return;
    }

    loadAppState().then((state) => {
      setUser(getCurrentUserForState(state));
    });
  }, [router]);

  async function submit() {
    if (!user) return;
    if (needsPassword && !passwordReady) {
      setError(passwordValidationError ?? "Passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    setWarning("");
    const response = await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email: user.email,
        displayName: user.displayName,
        slamType,
        year,
        gender,
        ...(needsPassword ? { password } : {})
      })
    });
    const result = await response.json();
    setBusy(false);

    if (!response.ok || !result.ok) {
      setError(result.error ?? "Could not create this bracket.");
      return;
    }

    if (result.profile) saveCurrentUser(result.profile);

    // If ESPN didn't have the draw yet, surface it so the commissioner knows
    // the bracket exists but is unpopulated until ESPN publishes the matchups.
    if (result.drawImport && result.drawImport.ok === false) {
      setWarning(`Bracket created, but ESPN draw is not available yet (${result.drawImport.error}). You can re-import it from the admin page once ESPN publishes the bracket.`);
    }

    router.push(`/pools/${result.pool.id}`);
  }

  return (
    <AppFrame>
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-xl border border-court-200 bg-white p-6 shadow-soft">
          <p className="text-sm font-bold uppercase tracking-wide text-court-700">Commissioner</p>
          <h1 className="mt-1 text-2xl font-black">Create a bracket</h1>
          <p className="mt-2 text-sm text-slate-600">Picks a Grand Slam, creates the invite link, and imports the draw from ESPN as soon as it&apos;s published.</p>

          <label className="mt-6 block text-sm font-semibold text-slate-700">
            Bracket name
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Grand Slam
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={slamType} onChange={(event) => setSlamType(event.target.value as SlamType)}>
              {SLAM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-700">
              Year
              <input type="number" min={2000} max={2100} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={year} onChange={(event) => setYear(Number(event.target.value))} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Draw
              <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={gender} onChange={(event) => setGender(event.target.value as Gender)}>
                <option value="men">Men&apos;s Singles</option>
                <option value="women">Women&apos;s Singles</option>
              </select>
            </label>
          </div>

          {needsPassword ? (
            <div className="mt-6 rounded-lg border border-court-200 bg-court-50 p-4">
              <p className="text-sm font-black text-ink">Create a commissioner password</p>
              <p className="mt-1 text-xs text-slate-600">
                You&apos;re about to run a bracket. Set a password so only you can lock picks, fix results, and manage members.
              </p>
              <div className="mt-3 space-y-3">
                <PasswordField label="Password" value={password} onChange={setPassword} onEnter={submit} />
                <PasswordField label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} onEnter={submit} />
                {password && passwordValidationError ? (
                  <p className="text-xs font-semibold text-clay-700">{passwordValidationError}</p>
                ) : password && confirmPassword && !passwordsMatch ? (
                  <p className="text-xs font-semibold text-clay-700">Passwords don&apos;t match.</p>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">At least 8 characters. You&apos;ll enter this whenever you sign in.</p>
                )}
              </div>
            </div>
          ) : user ? (
            <p className="mt-6 text-sm font-semibold text-slate-500">
              You&apos;ll manage this bracket with your existing commissioner password — nothing new to set up.
            </p>
          ) : null}

          {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
          {warning ? <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{warning}</p> : null}
          <button onClick={submit} disabled={busy || !user || !name.trim() || !passwordReady} className="mt-5 w-full rounded-lg bg-court-700 px-4 py-3 font-bold text-white disabled:bg-slate-300">
            {busy ? "Creating bracket..." : "Create bracket"}
          </button>
        </div>
      </main>
    </AppFrame>
  );
}
