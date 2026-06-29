import { NextResponse } from "next/server";
import { getCommissionerUserId } from "@/lib/auth/cookie";
import { isCurrentUserSiteOwner, isSiteOwnerConfigured } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Lets the client tell whether THIS browser has a verified commissioner session
 * (the httpOnly cookie it can't read itself). Returns the authenticated userId,
 * or null if there's no valid session — so the Admin page can prompt for the
 * password instead of letting a gated action fail confusingly. Also reports
 * whether this user is the site owner (and whether ownership is configured yet)
 * so the Admin page can show/hide the shared-tournament tools.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    userId: getCommissionerUserId(),
    isSiteOwner: await isCurrentUserSiteOwner(),
    ownerConfigured: isSiteOwnerConfigured()
  });
}
