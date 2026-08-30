"use client";

import { useEffect, useRef, useState } from "react";
import {
  Accidental as VexAccidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  TickContext,
  Voice,
} from "vexflow";
import { accidentalToVexFlow, notationToVexFlowKey } from "@/core/music/notes";
import type { TargetNote } from "@/types/music";

interface MusicStaffProps {
  notes: TargetNote[];
  currentIndex?: number;
  mode?: "single" | "sheet";
  feedback?: "correct" | "incorrect" | null;
  onReady?: () => void;
  className?: string;
}

function createVexNote(target: TargetNote, color: string): StaveNote {
  const note = new StaveNote({
    clef: "treble",
    keys: [notationToVexFlowKey(target.notation)],
    duration: "q",
    autoStem: true,
  });
  const accidental = accidentalToVexFlow(target.notation);
  if (accidental) note.addModifier(new VexAccidental(accidental), 0);
  note.setStyle({ fillStyle: color, strokeStyle: color });
  note.setLedgerLineStyle({ fillStyle: color, strokeStyle: color });
  return note;
}

export function MusicStaff({
  notes,
  currentIndex = 0,
  mode = "single",
  feedback,
  onReady,
  className,
}: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const [width, setWidth] = useState(mode === "single" ? 720 : 1050);

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || notes.length === 0) return;
    container.replaceChildren();
    const measureCount = Math.ceil(notes.length / 4);
    const measuresPerRow = width < 520 ? 1 : width < 680 ? 2 : 4;
    const rowHeight = 130;
    const rowCount = Math.ceil(measureCount / measuresPerRow);
    const height = mode === "single" ? 180 : rowCount * rowHeight + 10;
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);
    const context = renderer.getContext();
    // The notation surface remains paper-white in every app theme, so musical ink stays dark.
    const ink = "#0f172a";
    context.setFillStyle(ink);
    context.setStrokeStyle(ink);

    if (mode === "single") {
      const stave = new Stave(24, 28, width - 48);
      stave.addClef("treble").setContext(context).draw();
      const color = feedback === "correct" ? "#2dd4bf" : feedback === "incorrect" ? "#fb7185" : ink;
      const vexNote = createVexNote(notes[0], color);
      vexNote.setStave(stave).setContext(context);
      new TickContext().addTickable(vexNote).preFormat().setX(width / 2);
      vexNote.draw();
    } else {
      const usableWidth = width - 28;
      const measureWidth = usableWidth / Math.min(measuresPerRow, measureCount);
      for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
        const start = measureIndex * 4;
        const targets = notes.slice(start, start + 4);
        const rowIndex = Math.floor(measureIndex / measuresPerRow);
        const columnIndex = measureIndex % measuresPerRow;
        const startsRow = columnIndex === 0;
        const stave = new Stave(14 + columnIndex * measureWidth, 18 + rowIndex * rowHeight, measureWidth);
        if (startsRow) stave.addClef("treble");
        if (measureIndex === 0) stave.addTimeSignature("4/4");
        stave.setContext(context).draw();
        const vexNotes = targets.map((target, localIndex) => {
          const index = start + localIndex;
          const color =
            index === currentIndex
              ? feedback === "incorrect"
                ? "#fb7185"
                : "#2dd4bf"
              : index < currentIndex
                ? "#64748b"
                : ink;
          return createVexNote(target, color);
        });
        const voice = new Voice({ numBeats: targets.length, beatValue: 4 }).addTickables(vexNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.max(80, measureWidth - (startsRow ? (measureIndex === 0 ? 86 : 64) : 34)));
        voice.draw(context, stave);
      }
    }

    const frame = requestAnimationFrame(() => readyRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [notes, currentIndex, feedback, mode, width]);

  return (
    <div
      ref={containerRef}
      className={`music-staff min-h-45 w-full overflow-hidden rounded-xl bg-white/95 ${className ?? ""}`}
      aria-label={mode === "single" ? "Current treble-clef note" : `Sheet music, note ${currentIndex + 1} of ${notes.length}`}
    />
  );
}
