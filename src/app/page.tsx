import { ArrowRight, Gauge, Keyboard, Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <section className="grid grid-cols-[1.2fr_0.8fr] items-center gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-300">Piano sight-reading practice</p>
          <h1 className="mt-5 max-w-3xl text-6xl font-bold leading-[1.05] tracking-tight text-white">See the note. Play it without thinking.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">Build the reflex that turns notation into a physical response. Train accuracy, reaction time, ledger lines, and continuous reading with a real MIDI keyboard.</p>
          <div className="mt-9 flex gap-3">
            <Link href="/train"><Button size="lg">Start training <ArrowRight className="size-5" /></Button></Link>
            <Link href="/dashboard"><Button size="lg" variant="secondary">View progress</Button></Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">Designed for current Chrome Desktop · USB MIDI recommended</p>
        </div>
        <Card className="relative overflow-hidden p-7">
          <div className="absolute -right-20 -top-20 size-64 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="relative space-y-4">
            {[
              [Music2, "Read", "Treble notes and ledger lines rendered as real notation."],
              [Keyboard, "Play", "Answer on screen, computer keyboard, or USB MIDI."],
              [Gauge, "Improve", "Measure first-try accuracy and correct response time."],
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof Music2;
              return <div key={String(title)} className="flex gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-400/10 text-teal-300"><ItemIcon className="size-5" /></span><div><h2 className="font-semibold text-white">{String(title)}</h2><p className="mt-1 text-sm leading-6 text-slate-400">{String(copy)}</p></div></div>;
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
