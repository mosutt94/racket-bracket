import { NextResponse } from "next/server";
import {
  findProfileByEmail,
  getOrCreateProfileByEmailAndAuthenticate,
  isSupabaseConfigured
} from "@/lib/supabase/persistence";

/**
 * Email-first "sign in by email" endpoint.
 * - POST { email }            → look up only. Protected (password) accounts
 *                               return { needsPassword: true } WITHOUT the
 *                               profile (don't reveal identity pre-auth); a
 *                               password-less existing user returns the profile;
 *                               an unknown email returns { needsName: true }.
 * - POST { email, displayName } → create-or-update a password-less profile and
 *                               return it. Protected accounts still demand the
 *                               password instead.
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
    const existing = await findProfileByEmail(trimmedEmail);

    // Protected account: require the password no matter the phase, and never hand
    // back the profile (or let an unauthenticated caller rename it).
    if (existing?.hasPassword) {
      return NextResponse.json({ ok: true, needsPassword: true });
    }

    // Phase 2: a name was provided → create-or-update and sign in.
    if (trimmedName) {
      const profile = await getOrCreateProfileByEmailAndAuthenticate({ email: trimmedEmail, displayName: trimmedName });
      return NextResponse.json({ ok: true, profile });
    }

    // Phase 1: email only → existing password-less user signs straight in; an
    // unknown email is told we need a name.
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
