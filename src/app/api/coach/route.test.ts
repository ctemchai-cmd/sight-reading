import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient }));

const { POST } = await import("@/app/api/coach/route");

function request(body: unknown = { messages: [{ role: "user", text: "what next?" }] }): Request {
  return new Request("http://localhost/api/coach", { method: "POST", body: JSON.stringify(body) });
}

/** A client whose session claims are whatever the test needs them to be. */
function clientWithClaims(claims: Record<string, unknown> | null) {
  return {
    auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
    from: () => ({
      select: () => ({
        order: () => ({ limit: async () => ({ data: [] }) }),
        then: (resolve: (value: { data: never[] }) => void) => resolve({ data: [] }),
      }),
    }),
  };
}

describe("POST /api/coach", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // The proxy answers an unauthenticated page request with a redirect to
  // /login, which fetch follows silently and hands back as 200 HTML. An API
  // has to refuse in its own voice.
  it("refuses with 401 rather than a redirect when signed out", async () => {
    getSupabaseServerClient.mockResolvedValue(clientWithClaims(null));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("refuses an anonymous session, matching the proxy's rule", async () => {
    getSupabaseServerClient.mockResolvedValue(clientWithClaims({ sub: "abc", is_anonymous: true }));
    expect((await POST(request())).status).toBe(401);
  });

  it("refuses when Supabase is not configured at all", async () => {
    getSupabaseServerClient.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
  });

  it("says so plainly when the deployment has no Gemini key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    getSupabaseServerClient.mockResolvedValue(clientWithClaims({ sub: "abc" }));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining("GEMINI_API_KEY") });
  });

  it("rejects a body that is not a conversation awaiting a reply", async () => {
    getSupabaseServerClient.mockResolvedValue(clientWithClaims({ sub: "abc" }));
    expect((await POST(request({ messages: [] }))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
  });

  it("checks the session before it looks at the key, so an intruder learns nothing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    getSupabaseServerClient.mockResolvedValue(clientWithClaims(null));
    expect((await POST(request())).status).toBe(401);
  });
});
