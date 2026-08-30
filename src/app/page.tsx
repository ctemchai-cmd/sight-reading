import { ArrowRight, Gauge, Keyboard, Music2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="home-page mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      <section className="home-hero grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal-300">Piano sight-reading practice</p>
          <h1 className="home-title mt-5 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">See the note. Play it without thinking.</h1>
          <p className="home-copy mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:mt-6 sm:text-lg sm:leading-8">Build the reflex that turns notation into a physical response. Train accuracy, reaction time, ledger lines, and continuous reading with a real MIDI keyboard.</p>
          <div className="home-actions mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <Link href="/train"><Button className="w-full sm:w-auto" size="lg">Start training <ArrowRight className="size-5" /></Button></Link>
            <Link href="/dashboard"><Button className="w-full sm:w-auto" size="lg" variant="secondary">View progress</Button></Link>
          </div>
          <p className="home-support-note mt-5 text-xs text-slate-500">Designed for current Chrome Desktop · USB MIDI recommended</p>
        </div>
        <Card className="home-feature-card relative overflow-hidden p-4 sm:p-7">
          <div className="absolute -right-20 -top-20 size-64 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="home-feature-list relative space-y-4">
            {[
              [Music2, "Read", "Treble notes and ledger lines rendered as real notation."],
              [Keyboard, "Play", "Answer on screen, computer keyboard, or USB MIDI."],
              [Gauge, "Improve", "Measure first-try accuracy and correct response time."],
            ].map(([Icon, title, copy]) => {
              const ItemIcon = Icon as typeof Music2;
              return <div key={String(title)} className="home-feature-item flex gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-400/10 text-teal-300"><ItemIcon className="size-5" /></span><div><h2 className="font-semibold text-white">{String(title)}</h2><p className="home-feature-copy mt-1 text-sm leading-6 text-slate-400">{String(copy)}</p></div></div>;
            })}
          </div>
        </Card>
      </section>
    </div>
  );
}
