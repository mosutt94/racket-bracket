import { NextResponse } from "next/server";
import { getCommissionerUserId } from "@/lib/auth/cookie";

export const dynamic = "force-dynamic";

/**
 * Lets the client tell whether THIS browser has a verified commissioner session
 * (the httpOnly cookie it can't read itself). Returns the authenticated userId,
 * or null if there's no valid session — so the Admin page can prompt for the
 * password instead of letting a gated action fail confusingly.
 */
export async function GET() {
  return NextResponse.json({ ok: true, userId: getCommissionerUserId() });
}
