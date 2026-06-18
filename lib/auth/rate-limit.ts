// Best-effort in-process limiter for password attempts. Serverless instances
// don't share this map, so it's not a hard guarantee — but combined with scrypt's
// ~50-100ms cost it raises the price of online guessing meaningfully. A DB-backed
// attempts table is the future upgrade if stronger guarantees are needed.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, { count: number; firstAt: number }>();

/** Records an attempt and returns false once the window's limit is exceeded. */
export function allowPasswordAttempt(key: string): boolean {
  const now = Date.now();
  const k = key.trim().toLowerCase();
  const entry = attempts.get(k);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(k, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

/** Clears the counter after a successful auth. */
export function clearPasswordAttempts(key: string): void {
  attempts.delete(key.trim().toLowerCase());
}
