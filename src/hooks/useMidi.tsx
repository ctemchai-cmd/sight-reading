"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseMidiMessage } from "@/core/input/midiParser";
import type { NoteInputEvent } from "@/types/training";

export interface MidiDeviceOption {
  id: string;
  name: string;
  manufacturer: string;
  state: MIDIPortDeviceState;
}

export type MidiStatus = "unsupported" | "idle" | "requesting" | "connected" | "disconnected" | "denied" | "error";

interface MidiController {
  status: MidiStatus;
  devices: MidiDeviceOption[];
  selectedDeviceId: string;
  connect: () => Promise<void>;
  selectDevice: (id: string) => void;
  registerHandlers: (
    onNoteOn: (event: NoteInputEvent) => void,
    onNoteOff?: (midi: number) => void,
    onSustain?: (down: boolean) => void,
  ) => () => void;
}

const MidiContext = createContext<MidiController | null>(null);

export function MidiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MidiStatus>("idle");
  const [devices, setDevices] = useState<MidiDeviceOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const accessRef = useRef<MIDIAccess | null>(null);
  const selectedDeviceIdRef = useRef("");
  const noteOnRef = useRef<((event: NoteInputEvent) => void) | null>(null);
  const noteOffRef = useRef<((midi: number) => void) | null>(null);
  const sustainRef = useRef<((down: boolean) => void) | null>(null);

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
      if (message.kind === "sustain") {
        sustainRef.current?.(message.down);
        return;
      }
      if (message.kind === "note-off") {
        noteOffRef.current?.(message.midi);
        return;
      }
      noteOnRef.current?.({
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
    const currentId = selectedDeviceIdRef.current;
    const nextId = next.some((device) => device.id === currentId)
      ? currentId
      : next.find((device) => device.id === saved)?.id ?? next[0]?.id ?? "";
    selectedDeviceIdRef.current = nextId;
    setSelectedDeviceId(nextId);
    if (nextId) attachSelectedInput(nextId);
    else setStatus("disconnected");
  }, [attachSelectedInput]);

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

  const selectDevice = useCallback((deviceId: string) => {
    selectedDeviceIdRef.current = deviceId;
    setSelectedDeviceId(deviceId);
    localStorage.setItem("preferred-midi-device", deviceId);
    attachSelectedInput(deviceId);
  }, [attachSelectedInput]);

  const registerHandlers = useCallback((
    onNoteOn: (event: NoteInputEvent) => void,
    onNoteOff?: (midi: number) => void,
    onSustain?: (down: boolean) => void,
  ) => {
    noteOnRef.current = onNoteOn;
    noteOffRef.current = onNoteOff ?? null;
    sustainRef.current = onSustain ?? null;
    return () => {
      if (noteOnRef.current === onNoteOn) noteOnRef.current = null;
      if (noteOffRef.current === onNoteOff) noteOffRef.current = null;
      if (sustainRef.current === onSustain) sustainRef.current = null;
    };
  }, []);

  useEffect(
    () => () => {
      if (accessRef.current) accessRef.current.onstatechange = null;
      for (const input of accessRef.current?.inputs.values() ?? []) input.onmidimessage = null;
    },
    [],
  );

  const value = useMemo<MidiController>(() => ({
    status,
    devices,
    selectedDeviceId,
    connect,
    selectDevice,
    registerHandlers,
  }), [connect, devices, registerHandlers, selectDevice, selectedDeviceId, status]);

  return <MidiContext.Provider value={value}>{children}</MidiContext.Provider>;
}

function useMidiContext(): MidiController {
  const context = useContext(MidiContext);
  if (!context) throw new Error("MIDI controls must be used inside MidiProvider.");
  return context;
}

export function useMidi(
  onNoteOn: (event: NoteInputEvent) => void,
  onNoteOff?: (midi: number) => void,
  onSustain?: (down: boolean) => void,
) {
  const controller = useMidiContext();

  useEffect(
    () => controller.registerHandlers(onNoteOn, onNoteOff, onSustain),
    [controller, onNoteOff, onNoteOn, onSustain],
  );

  return controller;
}

export function useMidiController() {
  return useMidiContext();
}
