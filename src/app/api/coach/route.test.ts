// @vitest-environment node

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/coach/route";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

function request(
  body: unknown = { messages: [{ role: "user", text: "what next?" }] },
  token: string | null = sessionToken(),
): NextRequest {
  return new NextRequest("http://localhost/api/coach", {
    method: "POST",
    body: JSON.stringify(body),
    headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {},
  });
}

describe("POST /api/coach", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("APP_PASSWORD", "secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // The proxy answers an unauthenticated page request with a redirect to
  // /login, which fetch follows silently and hands back as 200 HTML. An API
  // has to refuse in its own voice.
  it("refuses with 401 rather than a redirect when signed out", async () => {
    const response = await POST(request(undefined, null));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("refuses a forged session cookie, matching the proxy's rule", async () => {
    expect((await POST(request(undefined, "forged"))).status).toBe(401);
  });

  it("refuses when no password is configured at all", async () => {
    const token = sessionToken();
    vi.stubEnv("APP_PASSWORD", "");
    expect((await POST(request(undefined, token))).status).toBe(401);
  });

  it("says so plainly when the deployment has no Gemini key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: expect.stringContaining("GEMINI_API_KEY") });
  });

  it("rejects a body that is not a conversation awaiting a reply", async () => {
    expect((await POST(request({ messages: [] }))).status).toBe(400);
    expect((await POST(request({}))).status).toBe(400);
  });

  // A retired model names its own replacement in Google's reply. Throwing that
  // away and guessing sends someone to check the wrong thing.
  it("passes Google's own explanation through instead of guessing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ error: { message: "This model is no longer available. Use models/gemini-3.6-flash." } }),
      { status: 404 },
    )));

    const response = await POST(request());
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("gemini-3.6-flash");
    vi.unstubAllGlobals();
  });

  it("falls back to advice when the failure carries no explanation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>gateway</html>", { status: 500 })));

    expect((await (await POST(request())).json()).error).toContain("GEMINI_MODEL");
    vi.unstubAllGlobals();
  });

  it("reports a spent quota as its own condition", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));

    expect((await POST(request())).status).toBe(429);
    vi.unstubAllGlobals();
  });

  // Gemini interleaves chunks with no text: usage metadata, a thought
  // signature, the finish reason. Draining these through a pull-based stream
  // stalled it forever on the first one — the reply stopped mid-sentence and
  // the page waited on a completion that could never come.
  it("streams to completion across chunks that carry no text", async () => {
    const encoder = new TextEncoder();
    const event = (payload: unknown) => encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(event({ candidates: [{ content: { parts: [{ text: "Practise " }] } }] }));
          controller.enqueue(event({ usageMetadata: { promptTokenCount: 12 } }));
          controller.enqueue(event({ candidates: [{ content: { parts: [{ thoughtSignature: "abc" }] } }] }));
          controller.enqueue(event({ candidates: [{ content: { parts: [{ text: "F4." }] } }] }));
          controller.close();
        },
      }),
      { status: 200 },
    )));

    const response = await POST(request());
    const body = await Promise.race([
      response.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("stream never closed")), 3000)),
    ]);
    expect(body).toBe("Practise F4.");
    vi.unstubAllGlobals();
  }, 10_000);

  it("checks the session before it looks at the key, so an intruder learns nothing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    expect((await POST(request(undefined, null))).status).toBe(401);
  });
});
