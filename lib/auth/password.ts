import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

// Server-only password hashing with node:crypto scrypt — no external dependency.
// Stored format: "scrypt$<saltHex>$<hashHex>".
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

export function hashPassword(plain: string): string {
  if (typeof plain !== "string" || plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verify. Returns false on any malformed stored value. */
export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || typeof plain !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(plain, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
