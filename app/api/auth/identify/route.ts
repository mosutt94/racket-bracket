import { NextResponse } from "next/server";
import { getOrCreateProfileByEmailAndAuthenticate, isSupabaseConfigured } from "@/lib/supabase/persistence";

/**
 * Lightweight "sign in by email" endpoint. There's no password / OTP step yet —
 * this just materializes (or fetches) the Supabase profile for an email + name
 * so the rest of the app has a real profile id to attach to actions.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { email, displayName } = await request.json();
  const trimmedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const trimmedName = typeof displayName === "string" ? displayName.trim() : "";

  if (!trimmedEmail || !trimmedName) {
    return NextResponse.json({ ok: false, error: "Email and display name are required." }, { status: 400 });
  }

  try {
    const profile = await getOrCreateProfileByEmailAndAuthenticate({ email: trimmedEmail, displayName: trimmedName });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not sign in." },
      { status: 500 }
    );
  }
}
