import { cookies } from "next/headers";
import { mintCommissionerToken, verifyCommissionerToken } from "./token";

// The capability cookie. httpOnly so JS/XSS can't read it; the client never
// handles the token, and same-origin admin fetches send it automatically.
export const COMMISSIONER_COOKIE = "rb_commish";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function setCommissionerCookie(userId: string): void {
  cookies().set(COMMISSIONER_COOKIE, mintCommissionerToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export function clearCommissionerCookie(): void {
  cookies().delete(COMMISSIONER_COOKIE);
}

/** Reads + verifies the cookie. Returns the authenticated userId or null. */
export function getCommissionerUserId(): string | null {
  return verifyCommissionerToken(cookies().get(COMMISSIONER_COOKIE)?.value ?? null);
}
