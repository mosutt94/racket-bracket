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

  function signOut() {
    clearCurrentUser();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#e8ede9]">
      {!compact ? <header className="border-b border-court-300 bg-white/90 backdrop-blur">
        <div
          className={cn(
            "mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-8",
            "max-w-7xl py-3"
          )}
        >
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-court-700 text-white">
              <Trophy size={18} />
            </span>
            Racket Bracket
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
            {user ? (
              <>
                <Link href="/dashboard" className="hidden hover:text-court-700 sm:inline">
                  Your brackets
                </Link>
                <button onClick={signOut} className="rounded-full bg-ink px-4 py-2 font-bold text-white hover:bg-court-900">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/auth" className="rounded-full bg-ink px-4 py-2 text-white hover:bg-court-900">
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
