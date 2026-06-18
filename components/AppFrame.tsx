"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { clearCurrentUser, getSavedCurrentUser } from "@/lib/current-user";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppFrame({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  const [user, setUser] = useState<Profile | null>(null);

  useEffect(() => {
    setUser(getSavedCurrentUser());
  }, []);

  async function signOut() {
    clearCurrentUser();
    setUser(null);
    // Drop the commissioner capability cookie too (httpOnly — JS can't clear it).
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // Network blip shouldn't trap the user signed in — redirect regardless.
    }
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#eef2ee]">
      {!compact ? <header className="bg-court-900 text-white shadow-md">
        <div
          className={cn(
            "mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8",
            "max-w-7xl py-3"
          )}
        >
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-lg font-black text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ball text-court-900">
              <Trophy size={18} />
            </span>
            Racket Bracket
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold text-court-50">
            {user ? (
              <button onClick={signOut} className="rounded-full bg-white px-4 py-2 font-bold text-court-900 hover:bg-court-50">
                Sign out
              </button>
            ) : (
              <Link href="/auth" className="rounded-full bg-white px-4 py-2 font-bold text-court-900 hover:bg-court-50">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header> : null}
      {children}
    </div>
  );
}
