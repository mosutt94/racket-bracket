import { NextResponse } from "next/server";
import { clearCommissionerCookie } from "@/lib/auth/cookie";

export const dynamic = "force-dynamic";

/** Clears the commissioner capability cookie (localStorage is cleared client-side). */
export async function POST() {
  clearCommissionerCookie();
  return NextResponse.json({ ok: true });
}
