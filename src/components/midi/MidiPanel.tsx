"use client";

import { Cable, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MidiDeviceOption, MidiStatus } from "@/hooks/useMidi";

interface MidiPanelProps {
  status: MidiStatus;
  devices: MidiDeviceOption[];
  selectedDeviceId: string;
  onConnect: () => void;
  onSelect: (id: string) => void;
}

export function MidiPanel({ status, devices, selectedDeviceId, onConnect, onSelect }: MidiPanelProps) {
  if (status === "unsupported") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
        <CircleAlert className="size-4" /> Web MIDI is unavailable. Use current Chrome Desktop or the virtual piano.
      </div>
    );
  }

  if (["idle", "denied", "error"].includes(status)) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <div>
          <p className="text-sm font-medium text-white">MIDI keyboard</p>
          <p className="text-xs text-slate-400">
            {status === "denied" ? "Permission was denied. Allow MIDI access in Chrome settings." : "USB and OS-paired Bluetooth MIDI inputs are supported."}
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={onConnect}>
          <Cable className="size-4" /> Connect MIDI
        </Button>
      </div>
    );
  }

  if (status === "requesting") {
    return <div className="flex items-center gap-2 text-sm text-slate-300"><LoaderCircle className="size-4 animate-spin" /> Waiting for Chrome MIDI permission…</div>;
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <span className={`size-2 rounded-full ${status === "connected" ? "bg-emerald-400" : "bg-amber-400"}`} />
      <label className="text-sm text-slate-300" htmlFor="midi-device">MIDI input</label>
      <select
        id="midi-device"
        value={selectedDeviceId}
        onChange={(event) => onSelect(event.target.value)}
        className="min-w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
      >
        {devices.length === 0 && <option value="">No device connected</option>}
        {devices.map((device) => (
          <option key={device.id} value={device.id}>{device.name} · {device.manufacturer}</option>
        ))}
      </select>
    </div>
  );
}
