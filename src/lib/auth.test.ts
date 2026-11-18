// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthConfigured, isValidSession, passwordMatches, safeNextPath, sessionToken } from "@/lib/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("fixed-password session", () => {
  it("accepts only the configured password", () => {
    vi.stubEnv("APP_PASSWORD", "correct horse");
    expect(passwordMatches("correct horse")).toBe(true);
    expect(passwordMatches("correct hors")).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });

  it("issues a token that is not the password and validates only itself", () => {
    vi.stubEnv("APP_PASSWORD", "correct horse");
    const token = sessionToken()!;
    expect(token).not.toContain("correct horse");
    expect(isValidSession(token)).toBe(true);
    expect(isValidSession(`${token}x`)).toBe(false);
    expect(isValidSession(undefined)).toBe(false);
  });

  it("signs every device out when the password changes", () => {
    vi.stubEnv("APP_PASSWORD", "first password");
    const token = sessionToken()!;
    vi.stubEnv("APP_PASSWORD", "second password");
    expect(isValidSession(token)).toBe(false);
  });

  // An unset variable must not turn the empty string into the password.
  it("fails closed when no password is configured", () => {
    vi.stubEnv("APP_PASSWORD", "");
    expect(isAuthConfigured()).toBe(false);
    expect(sessionToken()).toBeNull();
    expect(passwordMatches("")).toBe(false);
    expect(isValidSession("")).toBe(false);
  });

  it("only redirects within the site after logging in", () => {
    expect(safeNextPath("/train/reflex?length=25")).toBe("/train/reflex?length=25");
    expect(safeNextPath("//evil.example")).toBe("/train");
    expect(safeNextPath("/\\evil.example")).toBe("/train");
    expect(safeNextPath("https://evil.example")).toBe("/train");
    expect(safeNextPath(null)).toBe("/train");
  });
});
