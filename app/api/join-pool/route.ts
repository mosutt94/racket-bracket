import { NextResponse } from "next/server";
import { initialState } from "@/lib/seed";
import { isSupabaseConfigured, joinPool, joinPoolByEmail } from "@/lib/supabase/persistence";

export async function POST(request: Request) {
  const { inviteCode, userId, email, displayName } = await request.json();

  if (!inviteCode) {
    return NextResponse.json({ ok: false, error: "Invite code is required." }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    try {
      const result = email && displayName
        ? await joinPoolByEmail({ inviteCode, email, displayName })
        : userId
          ? await joinPool({ inviteCode, userId })
          : null;
      if (!email && !displayName && !userId) {
        return NextResponse.json({ ok: false, error: "Email and display name are required." }, { status: 400 });
      }
      if (!result) return NextResponse.json({ ok: false, error: "Invite code not found" }, { status: 404 });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not join bracket." }, { status: 500 });
    }
  }

  const pool = initialState.pools.find((item) => item.inviteCode.toLowerCase() === String(inviteCode).toLowerCase());
  if (!pool) return NextResponse.json({ ok: false, error: "Invite code not found" }, { status: 404 });
  return NextResponse.json({ ok: true, pool });
}
