"use client";

import { Cable } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MidiPanel } from "@/components/midi/MidiPanel";
import { useMidiController } from "@/hooks/useMidi";
import { cn } from "@/lib/utils";

export function MidiMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const midi = useMidiController();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const connected = midi.status === "connected";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="MIDI connection"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "relative flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:px-3",
          open ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white",
        )}
      >
        <Cable className="size-4" aria-hidden="true" />
        <span className="app-nav-link-label hidden md:inline">MIDI</span>
        <span className={cn("absolute right-1.5 top-1.5 size-2 rounded-full", connected ? "bg-emerald-400" : "bg-slate-600")} />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="MIDI connection settings"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] w-[min(22rem,calc(100vw-1rem))] rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl shadow-black/50"
        >
          <p className="mb-3 px-1 text-sm font-semibold text-white">MIDI connection</p>
          <MidiPanel
            status={midi.status}
            devices={midi.devices}
            selectedDeviceId={midi.selectedDeviceId}
            onConnect={() => void midi.connect()}
            onSelect={midi.selectDevice}
          />
        </div>
      )}
    </div>
  );
}
