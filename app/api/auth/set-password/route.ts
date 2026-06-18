import { NextResponse } from "next/server";
import {
  findPoolByInviteCode,
  getCredentialByEmail,
  isCommissionerOfPool,
  isSupabaseConfigured,
  setProfilePasswordHash
} from "@/lib/supabase/persistence";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getCommissionerUserId, setCommissionerCookie } from "@/lib/auth/cookie";
import { validatePassword } from "@/lib/password-rules";

export const dynamic = "force-dynamic";

/**
 * Set or change a commissioner password.
 *
 * - CHANGE mode (a `currentPassword` is supplied): authorized by the cookie, not
 *   the body. Verifies the current password, then overwrites.
 * - FIRST-TIME mode (no `currentPassword`): requires the pool `inviteCode` as a
 *   proof factor (the real commissioner has it) and only works when the account
 *   commissions that pool and has no password yet — closing the hijack window.
 *
 * Either way, success establishes/refreshes the cookie and returns the profile.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const body = await request.json();
  const trimmedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";

  const validationError = validatePassword(newPassword);
  if (validationError) {
    return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
  }

  try {
    // ---- CHANGE mode --------------------------------------------------------
    if (currentPassword) {
      const cookieUserId = getCommissionerUserId();
      if (!cookieUserId) {
        return NextResponse.json({ ok: false, error: "Sign in again to change your password." }, { status: 401 });
      }
      if (!trimmedEmail) {
        return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
      }
      const credential = await getCredentialByEmail(trimmedEmail);
      if (!credential || credential.profile.id !== cookieUserId) {
        return NextResponse.json({ ok: false, error: "Sign in again to change your password." }, { status: 403 });
      }
      if (!credential.passwordHash || !verifyPassword(currentPassword, credential.passwordHash)) {
        return NextResponse.json({ ok: false, error: "Your current password isn't right." }, { status: 401 });
      }
      await setProfilePasswordHash(cookieUserId, hashPassword(newPassword));
      setCommissionerCookie(cookieUserId);
      return NextResponse.json({ ok: true, profile: { ...credential.profile, hasPassword: true } });
    }

    // ---- FIRST-TIME mode ----------------------------------------------------
    if (!trimmedEmail || !inviteCode) {
      return NextResponse.json({ ok: false, error: "Email and bracket invite code are required." }, { status: 400 });
    }
    const credential = await getCredentialByEmail(trimmedEmail);
    if (!credential) {
      return NextResponse.json({ ok: false, error: "We couldn't find that account." }, { status: 404 });
    }
    if (credential.passwordHash) {
      return NextResponse.json({ ok: false, error: "This account already has a password." }, { status: 409 });
    }
    const pool = await findPoolByInviteCode(inviteCode);
    if (!pool || !(await isCommissionerOfPool(credential.profile.id, pool.id))) {
      return NextResponse.json(
        { ok: false, error: "That invite code doesn't match a bracket you run." },
        { status: 403 }
      );
    }
    await setProfilePasswordHash(credential.profile.id, hashPassword(newPassword));
    setCommissionerCookie(credential.profile.id);
    return NextResponse.json({ ok: true, profile: { ...credential.profile, hasPassword: true } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not set your password." },
      { status: 500 }
    );
  }
}
