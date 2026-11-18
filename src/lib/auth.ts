import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sight-reader-session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * The cookie carries a digest keyed on the password, never the password itself,
 * so changing APP_PASSWORD signs every device out without a second secret.
 */
function digest(password: string): Buffer {
  return createHmac("sha256", password).update("sight-reader-session").digest();
}

function configuredPassword(): string | null {
  return process.env.APP_PASSWORD || null;
}

export function isAuthConfigured(): boolean {
  return configuredPassword() !== null;
}

export function sessionToken(): string | null {
  const password = configuredPassword();
  return password ? digest(password).toString("base64url") : null;
}

export function passwordMatches(candidate: string): boolean {
  const password = configuredPassword();
  return password !== null && timingSafeEqual(digest(candidate), digest(password));
}

export function isValidSession(cookie: string | undefined): boolean {
  const token = sessionToken();
  if (!token || !cookie) return false;
  const expected = Buffer.from(token);
  const actual = Buffer.from(cookie);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A browser reads `/\host` as `//host`, so both spellings would leave the site. */
export function safeNextPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/train";
}
