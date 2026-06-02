import { NextResponse } from "next/server";
import { isSupabaseConfigured, removePoolMemberInSupabase } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { poolId, userId } = await request.json();
  if (!poolId || !userId) {
    return NextResponse.json({ ok: false, error: "poolId and userId are required." }, { status: 400 });
  }

  try {
    const result = await removePoolMemberInSupabase({ poolId, userId });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not remove member." },
      { status: 500 }
    );
  }
}
