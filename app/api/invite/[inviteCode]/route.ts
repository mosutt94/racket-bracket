import { NextResponse } from "next/server";
import { getInvitePreviewInSupabase, isSupabaseConfigured } from "@/lib/supabase/persistence";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { inviteCode: string } }) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  try {
    const preview = await getInvitePreviewInSupabase(params.inviteCode);
    if (!preview) {
      return NextResponse.json({ ok: false, error: "Invite not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...preview });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not load invite." },
      { status: 500 }
    );
  }
}
