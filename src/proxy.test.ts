// @vitest-environment node

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

const mockedCreateServerClient = vi.mocked(createServerClient);

function configureSupabaseClaims(claims?: Record<string, unknown>) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  mockedCreateServerClient.mockReturnValue({
    auth: { getClaims: vi.fn().mockResolvedValue({ data: { claims } }) },
  } as never);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("private route proxy", () => {
  it("fails closed and preserves the requested route when Supabase is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const response = await proxy(new NextRequest("https://trainer.example/train/reflex?length=25"));
    const location = new URL(response.headers.get("location")!);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("supabase-config");
    expect(location.searchParams.get("next")).toBe("/train/reflex?length=25");
  });

  it("rejects an authenticated email that is not allowlisted", async () => {
    configureSupabaseClaims({ sub: "user-1", email: "other@example.com", is_anonymous: false });
    vi.stubEnv("PRIVATE_ALLOWED_EMAILS", "owner@example.com");

    const response = await proxy(new NextRequest("https://trainer.example/dashboard"));
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("unauthorized");
  });

  it("allows an approved user and redirects them away from login", async () => {
    configureSupabaseClaims({ sub: "user-1", email: "Owner@Example.com", is_anonymous: false });
    vi.stubEnv("PRIVATE_ALLOWED_EMAILS", "owner@example.com");

    const protectedResponse = await proxy(new NextRequest("https://trainer.example/train/reflex"));
    expect(protectedResponse.headers.get("location")).toBeNull();

    const loginResponse = await proxy(new NextRequest("https://trainer.example/login?next=%2Fsettings"));
    expect(loginResponse.headers.get("location")).toBe("https://trainer.example/settings");
  });

  it("always redirects public sign-up to the private login", async () => {
    const response = await proxy(new NextRequest("https://trainer.example/signup"));
    expect(response.headers.get("location")).toBe("https://trainer.example/login?error=invite-only");
  });
});
