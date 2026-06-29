import { NextResponse } from "next/server";
import { isSupabaseConfigured, joinPool, joinPoolByEmail } from "@/lib/supabase/persistence";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { inviteCode, userId, email, displayName } = await request.json();

  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: "Invite code is required." }, { status: 400 });
  }
  if (!email && !displayName && !userId) {
    return NextResponse.json({ ok: false, error: "Email and display name are required." }, { status: 400 });
  }

  try {
    const result = email && displayName
      ? await joinPoolByEmail({ inviteCode, email, displayName })
      : userId
        ? await joinPool({ inviteCode, userId })
        : null;
    if (!result) return NextResponse.json({ ok: false, error: "Invite code not found" }, { status: 404 });
    if ("closed" in result && result.closed) {
      return NextResponse.json(
        { ok: false, closed: true, error: "Picking has closed for this bracket — the tournament has already started." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not join bracket." },
      { status: 500 }
    );
  }
}
