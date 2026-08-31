"use client";

import { Cloud, LogIn, LogOut, RefreshCw, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNoteName, midiToNotatedPitch } from "@/core/music/notes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const MODE_LINES: Record<string, { color: string; label: string }> = {
  reflex: { color: "#2dd4bf", label: "Reflex" },
  flash: { color: "#38bdf8", label: "Flash" },
  performance: { color: "#a78bfa", label: "Performance" },
  sheet: { color: "#fbbf24", label: "Sheet" },
};
import { cn, formatMilliseconds } from "@/lib/utils";
import { accuracyFluency, fluencyColor, responseFluency } from "@/core/training/fluency";
import { summarisePractice } from "@/core/training/practiceHistory";
import { PitchKeyboard, type KeyReading } from "@/components/dashboard/PitchKeyboard";
import { HISTORY_FAILURE_ADVICE, classifyHistoryFailure } from "@/lib/historyFailure";
import { loadNoteHistory } from "@/lib/noteStats";
import { flushPendingSessions } from "@/lib/sessionPersistence";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WeakNoteStat } from "@/types/training";

interface DisplaySession {
  id: string;
  mode: string;
  completedAt: string;
  completedTargets: number;
  accuracy: number;
  averageResponseMs: number | null;
  medianResponseMs: number | null;
}

interface CloudSessionRow {
  id: string;
  mode: string;
  completed_at: string;
  completed_targets: number;
  accuracy: number;
  average_response_ms: number | null;
  median_response_ms: number | null;
}


export function Dashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<DisplaySession[]>([]);
  const [noteStats, setNoteStats] = useState<WeakNoteStat[]>([]);
  const [cloudUser, setCloudUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatmapMetric, setHeatmapMetric] = useState<"speed" | "accuracy">("speed");
  const [rejected, setRejected] = useState(0);
  // Why the page is empty, when it is empty for a reason rather than for lack of practice.
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRejected((await flushPendingSessions()).rejected);
    const supabase = getSupabaseBrowserClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    setCloudUser(user?.email ?? null);

    if (supabase && user) {
      const [{ data: cloudSessions, error: sessionsError }, history] = await Promise.all([
        supabase.from("training_sessions").select("id,mode,completed_at,completed_targets,accuracy,average_response_ms,median_response_ms").order("completed_at", { ascending: false }),
        loadNoteHistory(),
      ]);
      // A refused query and an untouched account both return nothing, and only
      // one of them means "go and practise".
      setLoadError(sessionsError?.message ?? history.error);
      const rows = (cloudSessions ?? []) as unknown as CloudSessionRow[];
      setSessions(rows.map((row) => ({
        id: row.id,
        mode: row.mode,
        completedAt: row.completed_at,
        completedTargets: row.completed_targets,
        accuracy: Number(row.accuracy),
        averageResponseMs: row.average_response_ms === null ? null : Number(row.average_response_ms),
        medianResponseMs: row.median_response_ms === null ? null : Number(row.median_response_ms),
      })));
      setNoteStats(history.stats);
    } else {
      setSessions([]);
      setNoteStats([]);
      setLoadError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totals = useMemo(() => {
    const notes = sessions.reduce((sum, session) => sum + session.completedTargets, 0);
    const weightedAccuracy = notes
      ? sessions.reduce((sum, session) => sum + session.accuracy * session.completedTargets, 0) / notes
      : 0;
    const timed = sessions.filter((session) => session.averageResponseMs !== null);
    const averageResponse = timed.length
      ? timed.reduce((sum, session) => sum + (session.averageResponseMs ?? 0), 0) / timed.length
      : null;
    return { notes, weightedAccuracy, averageResponse };
  }, [sessions]);

  const practice = useMemo(() => summarisePractice(sessions.map((session) => session.completedAt)), [sessions]);

  // Each mode asks something different of the reader, so their response times
  // are not on one scale — a single line across all of them showed steps that
  // were changes of exercise rather than of skill.
  const trend = useMemo(
    () => [...sessions].reverse().map((session, index) => ({
      session: index + 1,
      [session.mode]: session.averageResponseMs ? Math.round(session.averageResponseMs) : null,
    })),
    [sessions],
  );
  const trendModes = useMemo(
    () => [...new Set(sessions.map((session) => session.mode))],
    [sessions],
  );
  /** The pitches the current view ranks worst, for the practise link. */
  const weakestMidis = useMemo(
    () => [...noteStats]
      .sort((a, b) => b.weakScore - a.weakScore)
      .slice(0, 6)
      .map((stat) => stat.midi)
      .sort((a, b) => a - b),
    [noteStats],
  );

  const keyReadings = useMemo(() => {
    const readings = new Map<number, KeyReading>();
    for (const stat of noteStats) {
      const fluency = heatmapMetric === "speed"
        ? responseFluency(stat.medianResponseMs)
        : accuracyFluency(stat.firstTryAccuracy);
      readings.set(stat.midi, {
        fluency,
        label: `${formatNoteName(midiToNotatedPitch(stat.midi))} · ${formatMilliseconds(stat.medianResponseMs)} · ${Math.round(stat.firstTryAccuracy * 100)}% first try · ${stat.trialCount} played`,
      });
    }
    return readings;
  }, [heatmapMetric, noteStats]);

  const signOut = async () => {
    await getSupabaseBrowserClient()?.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Progress</p><h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Training dashboard</h1><p className="mt-2 break-all text-sm text-slate-400">{cloudUser ? <span className="inline-flex items-center gap-2"><Cloud className="size-4 shrink-0" /> Synced as {cloudUser}</span> : "Private cloud history"}</p></div>
        <div className="flex flex-wrap gap-2"><Button className="flex-1 sm:flex-none" variant="ghost" onClick={() => void load()}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh</Button>{cloudUser ? <Button className="flex-1 sm:flex-none" variant="secondary" onClick={() => void signOut()}><LogOut className="size-4" /> Log out</Button> : <Link className="flex-1 sm:flex-none" href="/login"><Button className="w-full" variant="secondary"><LogIn className="size-4" /> Log in</Button></Link>}</div>
      </div>

      {loadError && (
        <Card className="mt-7 border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200 sm:mt-8">
          <p className="font-semibold">Your history could not be read</p>
          <p className="mt-1 leading-6">
            The page below is empty because the request was refused, not because there is nothing recorded.
          </p>
          <p className="mt-2 leading-6">{HISTORY_FAILURE_ADVICE[classifyHistoryFailure(loadError)]}</p>
          <p className="mt-2 font-mono text-xs text-rose-300">{loadError}</p>
        </Card>
      )}

      {rejected > 0 && (
        <Card className="mt-7 border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 sm:mt-8">
          <p className="font-semibold">
            {rejected} finished {rejected === 1 ? "session is" : "sessions are"} waiting and cannot be saved
          </p>
          <p className="mt-1 leading-6">
            The server refuses them as they stand, so they are held rather than retried forever. This usually
            means a migration in <code>supabase/migrations/</code> has not been applied yet — a session in a
            mode or clef the database does not accept is rejected on arrival. The browser console has the
            reason. Later sessions are unaffected and save normally.
          </p>
        </Card>
      )}

      <Card className="mt-7 flex flex-wrap items-center justify-between gap-5 p-5 sm:mt-8">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-white sm:text-3xl">
            {practice.currentStreak} {practice.currentStreak === 1 ? "day" : "days"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {practice.practisedToday
              ? "Practised today"
              : practice.currentStreak > 0
                ? "Practise today to keep the streak"
                : "Reading is built by turning up often — start a streak today"}
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex gap-1.5" aria-label={`Practised ${practice.daysThisWeek} of the last seven days`}>
            {practice.lastSevenDays.map((done, index) => (
              <span
                key={index}
                className={cn("size-3 rounded-full", done ? "bg-teal-400" : "bg-slate-700")}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="text-xs text-slate-400">
            <span className="block text-sm font-semibold text-white">{practice.bestStreak}</span>
            best streak
          </p>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        {[["Sessions", sessions.length], ["Total notes", totals.notes], ["First-try accuracy", `${Math.round(totals.weightedAccuracy * 100)}%`], ["Average response", formatMilliseconds(totals.averageResponse)]].map(([label, value]) => <Card key={String(label)} className="min-w-0 p-4 sm:p-5"><p className="break-words text-2xl font-bold text-white sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-400 sm:text-sm">{label}</p></Card>)}
      </div>

      {sessions.length === 0 && !loading ? (
        <Card className="mt-6 p-6 text-center sm:p-12"><p className="text-lg font-semibold text-white">No completed sessions yet</p><p className="mt-2 text-sm text-slate-400">Finish a Reflex or Sheet Reading session to populate the dashboard.</p><Link href="/train/reflex"><Button className="mt-5 w-full sm:w-auto">Start Reflex</Button></Link></Card>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="min-w-0 p-4 sm:p-5"><h2 className="font-semibold text-white">Average response over sessions</h2><p className="mt-1 text-xs text-slate-400">One line per mode — each asks something different, so their times only compare with themselves</p><div className="mt-4 h-64 sm:h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="session" stroke="#64748b" /><YAxis stroke="#64748b" unit="ms" width={52} /><Tooltip contentStyle={{ background: "#0f172a", borderColor: "#334155", borderRadius: 12 }} /><Legend />{trendModes.map((mode) => <Line key={mode} type="monotone" dataKey={mode} name={MODE_LINES[mode]?.label ?? mode} stroke={MODE_LINES[mode]?.color ?? "#94a3b8"} strokeWidth={3} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div></Card>
          <Card className="p-5"><h2 className="font-semibold text-white">Weakest notes</h2><div className="mt-4 space-y-3">{[...noteStats].sort((a, b) => b.weakScore - a.weakScore).slice(0, 6).map((stat) => <div key={stat.midi} className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3"><span className="font-semibold text-white">{formatNoteName(midiToNotatedPitch(stat.midi))}</span><span className="text-right text-sm text-slate-400">{formatMilliseconds(stat.medianResponseMs)}<span className="block text-xs">{Math.round(stat.firstTryAccuracy * 100)}%</span></span></div>)}</div></Card>
        </div>
      )}

      <Card className="mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Which keys read fluently</h2><p className="mt-1 text-xs text-slate-400">{heatmapMetric === "speed" ? "Green under 0.8s, red at 2.5s and slower" : "Green at 95% first try, red at 50% and below"} · unpractised keys stay plain</p></div><div className="grid grid-cols-2 rounded-lg border border-slate-700 p-1"><button onClick={() => setHeatmapMetric("speed")} className={`rounded-md px-3 py-1 text-sm ${heatmapMetric === "speed" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Response</button><button onClick={() => setHeatmapMetric("accuracy")} className={`rounded-md px-3 py-1 text-sm ${heatmapMetric === "accuracy" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Accuracy</button></div></div>
        <div className="mt-5">
          <PitchKeyboard readings={keyReadings} />
          {weakestMidis.length > 0 && (
            <Link href={`/train/reflex?focus=${weakestMidis.join(",")}`}>
              <Button className="mt-4 w-full sm:w-auto" size="sm">
                <Target className="size-4" /> Practise these {weakestMidis.length} pitches
              </Button>
            </Link>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
            <span>Worked out</span>
            <span
              className="h-2 flex-1 rounded-full"
              style={{ background: `linear-gradient(to right, ${fluencyColor(0)}, ${fluencyColor(0.5)}, ${fluencyColor(1)})` }}
            />
            <span>Read on sight</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
