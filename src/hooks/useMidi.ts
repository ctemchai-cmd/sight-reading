"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseMidiMessage } from "@/core/input/midiParser";
import type { NoteInputEvent } from "@/types/training";

export interface MidiDeviceOption {
  id: string;
  name: string;
  manufacturer: string;
  state: MIDIPortDeviceState;
}

export type MidiStatus = "unsupported" | "idle" | "requesting" | "connected" | "disconnected" | "denied" | "error";

export function useMidi(onNoteOn: (event: NoteInputEvent) => void, onNoteOff?: (midi: number) => void) {
  const [status, setStatus] = useState<MidiStatus>("idle");
  const [devices, setDevices] = useState<MidiDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const accessRef = useRef<MIDIAccess | null>(null);
  const onRef = useRef(onNoteOn);
  const offRef = useRef(onNoteOff);

  useEffect(() => {
    onRef.current = onNoteOn;
    offRef.current = onNoteOff;
  }, [onNoteOff, onNoteOn]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!("requestMIDIAccess" in navigator)) setStatus("unsupported");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const attachSelectedInput = useCallback((deviceId: string) => {
    const access = accessRef.current;
    if (!access) return;
    for (const input of access.inputs.values()) input.onmidimessage = null;
    const input = access.inputs.get(deviceId);
    if (!input) {
      setStatus("disconnected");
      return;
    }
    input.onmidimessage = (event) => {
      if (!event.data) return;
      const message = parseMidiMessage(event.data, event.timeStamp);
      if (!message) return;
      if (message.kind === "note-off") {
        offRef.current?.(message.midi);
        return;
      }
      onRef.current({
        midi: message.midi,
        velocity: message.velocity,
        source: "midi",
        occurredAtMs: message.occurredAtMs,
      });
    };
    setStatus(input.state === "connected" ? "connected" : "disconnected");
  }, []);

  const refreshDevices = useCallback(() => {
    const access = accessRef.current;
    if (!access) return;
    const next = [...access.inputs.values()].map((input) => ({
      id: input.id,
      name: input.name ?? "Unnamed MIDI input",
      manufacturer: input.manufacturer ?? "Unknown manufacturer",
      state: input.state,
    }));
    setDevices(next);
    const saved = localStorage.getItem("preferred-midi-device");
    const nextId = next.some((device) => device.id === selectedDeviceId)
      ? selectedDeviceId
      : next.find((device) => device.id === saved)?.id ?? next[0]?.id ?? "";
    setSelectedDeviceId(nextId);
    if (nextId) attachSelectedInput(nextId);
    else setStatus("disconnected");
  }, [attachSelectedInput, selectedDeviceId]);

  const connect = useCallback(async () => {
    if (!("requestMIDIAccess" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      accessRef.current = access;
      access.onstatechange = refreshDevices;
      refreshDevices();
    } catch (error) {
      setStatus(error instanceof DOMException && error.name === "SecurityError" ? "denied" : "error");
    }
  }, [refreshDevices]);

  const selectDevice = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      localStorage.setItem("preferred-midi-device", deviceId);
      attachSelectedInput(deviceId);
    },
    [attachSelectedInput],
  );

  useEffect(
    () => () => {
      if (accessRef.current) accessRef.current.onstatechange = null;
      for (const input of accessRef.current?.inputs.values() ?? []) input.onmidimessage = null;
    },
    [],
  );

  return { status, devices, selectedDeviceId, connect, selectDevice };
}
