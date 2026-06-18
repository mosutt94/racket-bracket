import { createHmac, timingSafeEqual } from "node:crypto";

// Stateless, HMAC-signed capability token: "<userId>.<expiryMs>.<sigBase64url>".
// It asserts only "this browser proved a commissioner password for userId, until
// expiry." Pool/tournament authorization is re-checked against the DB per request,
// so the token never needs to enumerate which pools the user commissions.
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  // Prefer a dedicated secret; fall back to the service-role key (server-only,
  // high-entropy) so the feature needs no new env var. Rotating either secret
  // invalidates all commissioner cookies at once — a benign forced re-login.
  const secret = process.env.COMMISSIONER_AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Commissioner auth secret is not configured.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function mintCommissionerToken(userId: string, ttlMs: number = DEFAULT_TTL_MS): string {
  const expiry = Date.now() + ttlMs;
  const payload = `${userId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the userId if the token is valid and unexpired, else null. */
export function verifyCommissionerToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiryStr, sig] = parts;
  const payload = `${userId}.${expiryStr}`;
  const expectedSig = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  return userId;
}
