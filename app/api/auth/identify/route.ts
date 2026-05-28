import { NextResponse } from "next/server";
import {
  findProfileByEmail,
  getOrCreateProfileByEmailAndAuthenticate,
  isSupabaseConfigured
} from "@/lib/supabase/persistence";

/**
 * Email-first "sign in by email" endpoint (no password / OTP yet).
 * - POST { email }            → look up only. Returns the profile if it exists,
 *                               otherwise { needsName: true } so the client can
 *                               prompt for a display name.
 * - POST { email, displayName } → create-or-update the profile and return it.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { email, displayName } = await request.json();
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const trimmedName = typeof displayName === "string" ? displayName.trim() : "";

  if (!trimmedEmail) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
  }

  try {
    // Phase 2: a name was provided → create-or-update and sign in.
    if (trimmedName) {
      const profile = await getOrCreateProfileByEmailAndAuthenticate({ email: trimmedEmail, displayName: trimmedName });
      return NextResponse.json({ ok: true, profile });
    }

    // Phase 1: email only → look up. Existing user signs straight in; new user
    // is told we need a name.
    const existing = await findProfileByEmail(trimmedEmail);
    if (existing) {
      return NextResponse.json({ ok: true, profile: existing });
    }
    return NextResponse.json({ ok: true, needsName: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not sign in." },
      { status: 500 }
    );
  }
}
