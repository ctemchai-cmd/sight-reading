"use client";

import { Play, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parseMessage, type Segment } from "@/core/assistant/markup";
import { MAX_MESSAGE_CHARS } from "@/core/assistant/prompt";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types/assistant";

/** Nothing arrives for the first several seconds while the model thinks. */
const THINKING_NOTICE_MS = 4000;
/** Long enough for a hard question, short enough that a dead request says so. */
const REQUEST_TIMEOUT_MS = 90_000;

const OPENERS = [
  "What should I practise next?",
  "Am I actually improving?",
  "Which notes are holding me back?",
  "How do I get faster at reading ledger lines?",
];

function InlineSegments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "bold") return <strong key={index} className="font-semibold text-white">{segment.text}</strong>;
        if (segment.kind === "text") return <span key={index}>{segment.text}</span>;
        return (
          <Link key={index} href={segment.href} className="mt-3 block sm:inline-block">
            <Button size="sm" className="w-full sm:w-auto">
              <Play className="size-4" aria-hidden="true" /> {segment.text}
            </Button>
          </Link>
        );
      })}
    </>
  );
}

function MessageBody({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-7">
      {parseMessage(text).map((block, index) => (
        <p key={index} className={cn("break-words", block.bullet && "flex gap-2 pl-1")}>
          {block.bullet && <span aria-hidden="true" className="text-teal-400">·</span>}
          <span><InlineSegments segments={block.segments} /></span>
        </p>
      ))}
    </div>
  );
}

export function CoachChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitedMs, setWaitedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // A measured reply spent ten seconds thinking before its first word. Without
  // a clock running, silence that long reads as a page that has given up.
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setWaitedMs(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, partial]);

  async function send(text: string): Promise<void> {
    const question = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!question || busy) return;

    const next: ChatMessage[] = [...messages, { role: "user", text: question }];
    setMessages(next);
    setDraft("");
    setError(null);
    setPartial("");
    setWaitedMs(0);
    setBusy(true);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(detail?.error ?? "The coach could not be reached.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setPartial(reply);
      }

      if (reply.trim()) setMessages([...next, { role: "model", text: reply }]);
      else setError("The coach replied with nothing. Try asking again.");
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === "TimeoutError"
          ? "The coach did not answer in time. Gemini's free tier is sometimes busy — try again."
          : "The connection dropped before the reply finished.",
      );
    } finally {
      setBusy(false);
      setPartial("");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && !busy && (
          <Card className="p-5">
            <p className="flex items-center gap-2 font-semibold text-white">
              <Sparkles className="size-4 text-teal-300" aria-hidden="true" /> Ask about your practice
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The coach can see your session history, your per-pitch times and your streak, and it knows how
              this application&apos;s modes and settings work. Ask in any language.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Replies come from Google Gemini. Your questions and your training statistics are sent there;
              your account details are not.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {OPENERS.map((opener) => (
                <Button key={opener} variant="secondary" size="sm" onClick={() => void send(opener)}>
                  {opener}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {messages.map((message, index) =>
          message.role === "user" ? (
            <div key={index} className="flex justify-end">
              <p className="max-w-[85%] break-words rounded-2xl rounded-br-sm bg-teal-500 px-4 py-2 font-medium text-slate-950">
                {message.text}
              </p>
            </div>
          ) : (
            <Card key={index} className="p-4 text-slate-300 sm:p-5">
              <MessageBody text={message.text} />
            </Card>
          ),
        )}

        {busy && (
          <Card className="p-4 text-slate-300 sm:p-5">
            {partial ? (
              <MessageBody text={partial} />
            ) : (
              <p className="flex items-center gap-2 text-sm text-slate-400" aria-live="polite">
                <Sparkles className="size-4 animate-pulse text-teal-300" aria-hidden="true" />
                {waitedMs < THINKING_NOTICE_MS
                  ? "Reading your history…"
                  : `Thinking it over — ${Math.round(waitedMs / 1000)}s`}
              </p>
            )}
          </Card>
        )}

        {error && (
          <Card className="border-rose-500/40 bg-rose-500/10 p-4 text-sm leading-6 text-rose-200">{error}</Card>
        )}

        <div ref={bottomRef} />
      </div>

      <form
        className="flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="Ask about your practice…"
          aria-label="Ask the coach"
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus-visible:border-teal-400 focus-visible:outline-none disabled:opacity-60"
        />
        <Button type="submit" disabled={busy || draft.trim() === ""} aria-label="Send">
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}
