import { NextResponse } from "next/server";
import { getCredentialByEmail, isSupabaseConfigured } from "@/lib/supabase/persistence";
import { verifyPassword } from "@/lib/auth/password";
import { setCommissionerCookie } from "@/lib/auth/cookie";
import { allowPasswordAttempt, clearPasswordAttempts } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Verify a commissioner password at sign-in. On success, establishes the
 * httpOnly capability cookie and returns the profile. Errors are intentionally
 * generic so they don't reveal whether an email exists.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { email, password } = await request.json();
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!trimmedEmail || typeof password !== "string" || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }

  if (!allowPasswordAttempt(trimmedEmail)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  try {
    const credential = await getCredentialByEmail(trimmedEmail);
    if (!credential || !credential.passwordHash || !verifyPassword(password, credential.passwordHash)) {
      return NextResponse.json({ ok: false, error: "That password doesn't match. Try again." }, { status: 401 });
    }
    clearPasswordAttempts(trimmedEmail);
    setCommissionerCookie(credential.profile.id);
    return NextResponse.json({ ok: true, profile: credential.profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not sign in." },
      { status: 500 }
    );
  }
}
