import { ArrowRight, Focus, Music, TimerReset, Zap } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

const modes = [
  { href: "/train/flash", icon: Zap, title: "Flash", description: "One note, answered, gone. Pure recognition with nothing to read ahead to.", available: true },
  { href: "/train/reflex", icon: TimerReset, title: "Reflex", description: "A moving stream of notes. Trains the eye to run ahead of the hands.", available: true },
  { href: "/train/sheet", icon: Music, title: "Sheet Reading", description: "Read four measures ahead while the cursor tracks the expected note.", available: true },
  { href: "#", icon: Focus, title: "Performance", description: "Continuous tempo-based reading without stopping.", available: false },
];

export default function TrainPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Training modes</p>
      <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Choose what to practice</h1>
      <div className="mt-7 grid gap-4 sm:mt-9 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {modes.map(({ href, icon: Icon, title, description, available }) => {
          const card = <Card className={`group h-full p-6 transition-colors ${available ? "hover:border-teal-400/60" : "opacity-55"}`}><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-xl bg-teal-400/10 text-teal-300"><Icon /></span>{available ? <ArrowRight className="size-5 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-teal-300" /> : <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">Coming later</span>}</div><h2 className="mt-7 text-xl font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></Card>;
          return available ? <Link key={title} href={href}>{card}</Link> : <div key={title}>{card}</div>;
        })}
      </div>
    </div>
  );
}
