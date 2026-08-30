"use client";

import { Cloud, LogIn, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNoteName, midiToNotatedPitch, naturalMidisInRange } from "@/core/music/notes";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatMilliseconds } from "@/lib/utils";
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

interface CloudStatRow {
  midi: number;
  trial_count: number;
  first_try_correct_count: number;
  incorrect_attempt_count: number;
  average_response_ms: number | null;
  median_response_ms: number | null;
  best_response_ms: number | null;
}

export function Dashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<DisplaySession[]>([]);
  const [noteStats, setNoteStats] = useState<WeakNoteStat[]>([]);
  const [cloudUser, setCloudUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatmapMetric, setHeatmapMetric] = useState<"speed" | "accuracy">("speed");

  const load = useCallback(async () => {
    setLoading(true);
    await flushPendingSessions();
    const supabase = getSupabaseBrowserClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    setCloudUser(user?.email ?? null);

    if (supabase && user) {
      const [{ data: cloudSessions }, { data: cloudStats }] = await Promise.all([
        supabase.from("training_sessions").select("id,mode,completed_at,completed_targets,accuracy,average_response_ms,median_response_ms").order("completed_at", { ascending: false }),
        supabase.from("user_note_stats").select("midi,trial_count,first_try_correct_count,incorrect_attempt_count,average_response_ms,median_response_ms,best_response_ms"),
      ]);
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
      setNoteStats(((cloudStats ?? []) as unknown as CloudStatRow[]).map((row) => ({
        midi: row.midi,
        trialCount: row.trial_count,
        firstTryCorrectCount: row.first_try_correct_count,
        incorrectAttemptCount: row.incorrect_attempt_count,
        firstTryAccuracy: row.trial_count ? row.first_try_correct_count / row.trial_count : 0,
        averageResponseMs: Number(row.average_response_ms ?? 0),
        medianResponseMs: Number(row.median_response_ms ?? 0),
        bestResponseMs: Number(row.best_response_ms ?? 0),
        weakScore: 1,
      })));
    } else {
      setSessions([]);
      setNoteStats([]);
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

  const trend = [...sessions].reverse().map((session, index) => ({
    session: index + 1,
    speed: session.averageResponseMs ? Math.round(session.averageResponseMs) : null,
    accuracy: Math.round(session.accuracy * 100),
  }));
  const byMidi = new Map(noteStats.map((stat) => [stat.midi, stat]));
  // Naturals always have a cell so the shape of the keyboard stays readable;
  // sharps and flats appear once a key signature has actually put them in play.
  const heatmapMidis = useMemo(() => {
    const practised = noteStats.map((stat) => stat.midi).filter((midi) => midi >= 53 && midi <= 88);
    return [...new Set([...naturalMidisInRange(53, 88), ...practised])].sort((a, b) => a - b);
  }, [noteStats]);

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

      <div className="mt-7 grid grid-cols-2 gap-3 sm:mt-8 xl:grid-cols-4 xl:gap-4">
        {[["Sessions", sessions.length], ["Total notes", totals.notes], ["First-try accuracy", `${Math.round(totals.weightedAccuracy * 100)}%`], ["Average response", formatMilliseconds(totals.averageResponse)]].map(([label, value]) => <Card key={String(label)} className="min-w-0 p-4 sm:p-5"><p className="break-words text-2xl font-bold text-white sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-400 sm:text-sm">{label}</p></Card>)}
      </div>

      {sessions.length === 0 && !loading ? (
        <Card className="mt-6 p-6 text-center sm:p-12"><p className="text-lg font-semibold text-white">No completed sessions yet</p><p className="mt-2 text-sm text-slate-400">Finish a Reflex or Sheet Reading session to populate the dashboard.</p><Link href="/train/reflex"><Button className="mt-5 w-full sm:w-auto">Start Reflex</Button></Link></Card>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="min-w-0 p-4 sm:p-5"><h2 className="font-semibold text-white">Average response over sessions</h2><div className="mt-5 h-64 sm:h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="session" stroke="#64748b" /><YAxis stroke="#64748b" unit="ms" width={52} /><Tooltip contentStyle={{ background: "#0f172a", borderColor: "#334155", borderRadius: 12 }} /><Line type="monotone" dataKey="speed" stroke="#2dd4bf" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div></Card>
          <Card className="p-5"><h2 className="font-semibold text-white">Weakest notes</h2><div className="mt-4 space-y-3">{[...noteStats].sort((a, b) => b.medianResponseMs - a.medianResponseMs || a.firstTryAccuracy - b.firstTryAccuracy).slice(0, 6).map((stat) => <div key={stat.midi} className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3"><span className="font-semibold text-white">{formatNoteName(midiToNotatedPitch(stat.midi))}</span><span className="text-right text-sm text-slate-400">{formatMilliseconds(stat.medianResponseMs)}<span className="block text-xs">{Math.round(stat.firstTryAccuracy * 100)}%</span></span></div>)}</div></Card>
        </div>
      )}

      <Card className="mt-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Treble pitch heatmap</h2><p className="mt-1 text-xs text-slate-400">F3–E6 · darker cells need more practice · sharps and flats appear once practised</p></div><div className="grid grid-cols-2 rounded-lg border border-slate-700 p-1"><button onClick={() => setHeatmapMetric("speed")} className={`rounded-md px-3 py-1 text-sm ${heatmapMetric === "speed" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Response</button><button onClick={() => setHeatmapMetric("accuracy")} className={`rounded-md px-3 py-1 text-sm ${heatmapMetric === "accuracy" ? "bg-slate-700 text-white" : "text-slate-400"}`}>Accuracy</button></div></div>
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:grid-cols-12 xl:grid-cols-[repeat(21,minmax(0,1fr))] xl:gap-2">{heatmapMidis.map((midi) => { const stat = byMidi.get(midi); const severity = !stat ? 0 : heatmapMetric === "speed" ? Math.min(1, stat.medianResponseMs / 1800) : 1 - stat.firstTryAccuracy; return <div key={midi} className="min-w-0 rounded-lg border border-slate-800 p-1.5 text-center sm:p-2" style={{ backgroundColor: stat ? `rgb(244 63 94 / ${0.08 + severity * 0.5})` : "rgb(15 23 42 / .55)" }} title={stat ? `${formatMilliseconds(stat.medianResponseMs)}, ${Math.round(stat.firstTryAccuracy * 100)}%` : "Not practiced"}><p className="truncate text-[11px] font-semibold text-white sm:text-xs">{formatNoteName(midiToNotatedPitch(midi))}</p><p className="mt-1 truncate text-[9px] text-slate-400 sm:text-[10px]">{!stat ? "—" : heatmapMetric === "speed" ? formatMilliseconds(stat.medianResponseMs) : `${Math.round(stat.firstTryAccuracy * 100)}%`}</p></div>; })}</div>
      </Card>
    </div>
  );
}
