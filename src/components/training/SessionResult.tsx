import { RotateCcw, Target, TrendingUp } from "lucide-react";
import { formatNoteName, midiToNotatedPitch } from "@/core/music/notes";
import { formatMilliseconds } from "@/lib/utils";
import type { TrainingSummary } from "@/types/training";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface SessionResultProps {
  summary: TrainingSummary;
  syncStatus?: "saving" | "pending" | "synced";
  onRetry: () => void;
  onPracticeWeak?: () => void;
}

export function SessionResult({ summary, syncStatus, onRetry, onPracticeWeak }: SessionResultProps) {
  const metrics = [
    ["First-try accuracy", `${Math.round(summary.accuracy * 100)}%`],
    ["Average", formatMilliseconds(summary.averageResponseMs)],
    ["Median", formatMilliseconds(summary.medianResponseMs)],
    ["Best", formatMilliseconds(summary.bestResponseMs)],
    ["Mistakes", String(summary.mistakeCount)],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-teal-400/15 text-teal-300"><TrendingUp /></span>
        <h1 className="text-3xl font-bold text-white">Session complete</h1>
        <p className="mt-2 text-slate-400">{summary.completedTargets} targets completed · {syncStatus === "pending" ? "Cloud save queued" : syncStatus === "synced" ? "Saved to cloud" : "Saving…"}</p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {metrics.map(([label, value]) => (
          <Card key={label} className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="mt-1 text-xs text-slate-400">{label}</p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="font-semibold text-white">Weakest notes</h2>
        <div className="mt-3 grid grid-cols-5 gap-3">
          {summary.weakNotes.slice(0, 5).map((stat) => (
            <div key={stat.midi} className="rounded-xl bg-slate-950/60 p-3">
              <p className="font-semibold text-white">{formatNoteName(midiToNotatedPitch(stat.midi))}</p>
              <p className="text-sm text-slate-400">{formatMilliseconds(stat.medianResponseMs)}</p>
              <p className="text-xs text-slate-500">{Math.round(stat.firstTryAccuracy * 100)}% first try</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex justify-center gap-3">
        {onPracticeWeak && summary.weakNotes.length > 0 && (
          <Button onClick={onPracticeWeak}><Target className="size-4" /> Practice weak notes</Button>
        )}
        <Button variant="secondary" onClick={onRetry}><RotateCcw className="size-4" /> New session</Button>
      </div>
    </div>
  );
}
