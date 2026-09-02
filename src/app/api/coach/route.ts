import { summariseForCoach } from "@/core/assistant/context";
import { buildGeminiRequest, parseChatMessages } from "@/core/assistant/prompt";
import { createSseTextDecoder } from "@/core/assistant/stream";
import { summarisePractice } from "@/core/training/practiceHistory";
import { NOTE_STAT_COLUMNS, noteStatsFromRows } from "@/lib/noteStats";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CoachSession } from "@/types/assistant";
import type { WeakNoteStat } from "@/types/training";

const DEFAULT_MODEL = "gemini-2.5-flash";
const SESSION_COLUMNS = "mode,completed_at,completed_targets,accuracy,median_response_ms";
/** Enough to show a trend; the whole history would only cost quota. */
const SESSION_LIMIT = 30;

interface SessionRow {
  mode: CoachSession["mode"];
  completed_at: string;
  completed_targets: number;
  accuracy: number;
  median_response_ms: number | null;
}

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * The player's history, read as the player. The server client forwards their
 * cookies, so row-level security scopes both queries — this application has no
 * service-role key and must not grow one for a chat feature.
 */
async function loadHistory(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseServerClient>>>,
): Promise<{ sessions: CoachSession[]; weakNotes: WeakNoteStat[] }> {
  const [sessions, notes] = await Promise.all([
    supabase.from("training_sessions").select(SESSION_COLUMNS).order("completed_at", { ascending: false }).limit(SESSION_LIMIT),
    supabase.from("user_note_stats").select(NOTE_STAT_COLUMNS),
  ]);

  const rows = (sessions.data ?? []) as unknown as SessionRow[];
  return {
    sessions: rows.map((row) => ({
      mode: row.mode,
      completedAt: row.completed_at,
      completedTargets: row.completed_targets,
      accuracy: Number(row.accuracy),
      medianResponseMs: row.median_response_ms === null ? null : Number(row.median_response_ms),
    })),
    weakNotes: noteStatsFromRows(notes.data),
  };
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;

  // The proxy does not guard /api, and it should not: it answers with a
  // redirect to /login, which fetch follows silently and hands back as 200
  // HTML. An API has to refuse in its own voice.
  const supabase = await getSupabaseServerClient();
  const claims = supabase ? (await supabase.auth.getClaims().catch(() => null))?.data?.claims : undefined;
  if (!supabase || !claims?.sub || claims.is_anonymous === true) {
    return fail(401, "Sign in to use the coach.");
  }

  if (!apiKey) {
    return fail(503, "The coach is not configured: GEMINI_API_KEY is missing from this deployment.");
  }

  const body = await request.json().catch(() => null);
  const messages = parseChatMessages((body as { messages?: unknown } | null)?.messages);
  if (!messages) return fail(400, "Expected a non-empty list of messages ending with a question.");

  const { sessions, weakNotes } = await loadHistory(supabase);
  const practice = summarisePractice(sessions.map((session) => session.completedAt));
  const payload = buildGeminiRequest(messages, summariseForCoach(sessions, weakNotes, practice));

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
    const detail = upstream ? await upstream.text().catch(() => "") : "";
    console.error("Gemini request failed", upstream?.status, detail);
    if (upstream?.status === 429) return fail(429, "Gemini's free quota is spent for now. Try again later.");
    return fail(502, "Gemini could not be reached. The key or the model name may be wrong.");
  }

  const decode = createSseTextDecoder();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      const text = decode(decoder.decode(value, { stream: true }));
      if (text) controller.enqueue(encoder.encode(text));
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
