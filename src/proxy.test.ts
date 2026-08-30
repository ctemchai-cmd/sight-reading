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

  it("rejects an anonymous Supabase session", async () => {
    configureSupabaseClaims({ sub: "anonymous-1", is_anonymous: true });

    const response = await proxy(new NextRequest("https://trainer.example/dashboard"));
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("allows a non-anonymous Supabase user and redirects them away from login", async () => {
    configureSupabaseClaims({ sub: "user-1", email: "user@example.com", is_anonymous: false });

    const protectedResponse = await proxy(new NextRequest("https://trainer.example/train/reflex"));
    expect(protectedResponse.headers.get("location")).toBeNull();

    const loginResponse = await proxy(new NextRequest("https://trainer.example/login?next=%2Fsettings"));
    expect(loginResponse.headers.get("location")).toBe("https://trainer.example/settings");
  });
});
