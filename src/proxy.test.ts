// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { proxy } from "@/proxy";

function requestWithSession(url: string, token: string | null) {
  return new NextRequest(url, { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("private route proxy", () => {
  it("fails closed and preserves the requested route when no password is configured", () => {
    vi.stubEnv("APP_PASSWORD", "");

    const response = proxy(requestWithSession("https://trainer.example/train/reflex?length=25", "anything"));
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/train/reflex?length=25");
  });

  it("rejects a session cookie that was not issued for this password", () => {
    vi.stubEnv("APP_PASSWORD", "old password");
    const stale = sessionToken();
    vi.stubEnv("APP_PASSWORD", "new password");

    const response = proxy(requestWithSession("https://trainer.example/settings", stale));
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("keeps Free Play private", () => {
    vi.stubEnv("APP_PASSWORD", "secret");

    const response = proxy(requestWithSession("https://trainer.example/play", null));
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/play");
  });

  it("allows a valid session and redirects it away from login", () => {
    vi.stubEnv("APP_PASSWORD", "secret");
    const token = sessionToken();

    const protectedResponse = proxy(requestWithSession("https://trainer.example/train/reflex", token));
    expect(protectedResponse.headers.get("location")).toBeNull();

    const loginResponse = proxy(requestWithSession("https://trainer.example/login?next=%2Fsettings", token));
    expect(loginResponse.headers.get("location")).toBe("https://trainer.example/settings");
  });
});
