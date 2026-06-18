// Shared by client forms (instant feedback) and server routes (source of truth),
// so the two never disagree on what counts as a valid password.

export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message if the password is invalid, or null if it passes. */
export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}
