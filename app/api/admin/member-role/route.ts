import { NextResponse } from "next/server";
import { isSupabaseConfigured, setPoolMemberRoleInSupabase } from "@/lib/supabase/persistence";
import { requireCommissionerForPool } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** Commissioner promotes a member to co-commissioner ("commissioner" role) or demotes back to "member". */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 });
  }

  const { poolId, userId, role } = await request.json();
  if (!poolId || !userId || (role !== "commissioner" && role !== "member")) {
    return NextResponse.json({ ok: false, error: "poolId, userId, and a valid role are required." }, { status: 400 });
  }

  const guard = await requireCommissionerForPool(poolId);
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });

  try {
    await setPoolMemberRoleInSupabase({ poolId, userId, role });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not update role." },
      { status: 400 }
    );
  }
}
