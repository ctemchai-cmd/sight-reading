import type { NextRequest } from "next/server";
import { buildGeminiRequest, parseChatMessages } from "@/core/assistant/prompt";
import { createSseTextDecoder } from "@/core/assistant/stream";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";

// Google retires a model for new keys without retiring it from the model
// listing, so a name that still appears in /models can answer 404 to every
// call. Overridable with GEMINI_MODEL when this one is retired in turn.
/**
 * The model thinks before it answers, and a long question measured ten seconds
 * to its first word and thirteen to its last. Vercel's default cap is shorter
 * than that, so the reply would be cut off in the deployment while working
 * locally.
 */
export const maxDuration = 60;

const DEFAULT_MODEL = "gemini-3.6-flash";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** Google's own explanation, which usually names the fix. */
function upstreamMessage(body: string): string {
  try {
    const message = (JSON.parse(body) as { error?: { message?: string } }).error?.message;
    if (message) return message;
  } catch {
    // Not the JSON error envelope; fall through to the generic advice.
  }
  return "Check GEMINI_API_KEY and GEMINI_MODEL.";
}

export async function POST(request: NextRequest): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;

  // The proxy does not guard /api, and it should not: it answers with a
  // redirect to /login, which fetch follows silently and hands back as 200
  // HTML. An API has to refuse in its own voice.
  if (!isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) {
    return fail(401, "Sign in to use the coach.");
  }

  if (!apiKey) {
    return fail(503, "The coach is not configured: GEMINI_API_KEY is missing from this deployment.");
  }

  const body = await request.json().catch(() => null);
  const messages = parseChatMessages((body as { messages?: unknown } | null)?.messages);
  if (!messages) return fail(400, "Expected a non-empty list of messages ending with a question.");

  const payload = buildGeminiRequest(messages);

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
    },
  ).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    if (!upstream) return fail(502, "Gemini could not be reached at all. Check the network.");
    const detail = await upstream.text().catch(() => "");
    console.error("Gemini request failed", upstream.status, detail);
    if (upstream.status === 429) return fail(429, "Gemini's free quota is spent for now. Try again later.");
    // Google says exactly what is wrong — a retired model names its own
    // replacement, a rejected key says so. Guessing "the key or the model may
    // be wrong" in its place sends someone to check the wrong thing.
    return fail(502, `Gemini refused the request (${upstream.status}). ${upstreamMessage(detail)}`);
  }

  const decode = createSseTextDecoder();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // A transform, not a ReadableStream with a pull: a pull that resolves
  // without enqueuing is never called again, and Gemini interleaves chunks
  // that carry no text at all — usage metadata, a thought signature, the
  // finish reason. The first of those stalled the response forever, which cut
  // the reply off mid-sentence and left the page waiting on a reply that could
  // never arrive. A transform is pushed to, so a turn that emits nothing is
  // simply a turn that emits nothing.
  const toPlainText = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = decode(decoder.decode(chunk, { stream: true }));
      if (text) controller.enqueue(encoder.encode(text));
    },
  });

  return new Response(upstream.body.pipeThrough(toPlainText), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
