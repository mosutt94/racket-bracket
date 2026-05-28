"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getSavedCurrentUser } from "@/lib/current-user";

export function HomeHeroActions() {
  // Render the signed-out CTA first, then swap after mount once we can read
  // localStorage (avoids an SSR/hydration mismatch).
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(Boolean(getSavedCurrentUser()));
  }, []);

  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {signedIn ? (
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-court-900 hover:bg-court-50">
          Go to your brackets <ArrowRight size={18} />
        </Link>
      ) : (
        <Link href="/auth" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-court-900 hover:bg-court-50">
          Sign in or create your bracket <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}
