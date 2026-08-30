"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

// The notation surface remains paper-white in every app theme, so musical ink stays dark.
const INK = "#0f172a";
const CORRECT = "#2dd4bf";
const INCORRECT = "#fb7185";
const SHEET_PLAYED = "#64748b";
const STREAM_PLAYED = "#94a3b8";
const SLIDE_MS = 300;
// Five treble lines 10px apart, and VexFlow's default gap between a stave's y and
// its top line. Three ledger lines either way plus a note head need 35px of
// clearance, so a stream container shorter than 110px starts clipping F3 and E6.
const STAVE_LINES_PX = 40;
const SPACE_ABOVE_STAVE_PX = 41;
// Filling a focus-mode container means scaling the notation up rather than
// floating a small staff in a tall box. Past this the notes read as stretched
// against the unchanged horizontal spacing.
const BASE_STREAM_HEIGHT = 150;
const MAX_FILL_SCALE = 2.2;

interface MusicStaffProps {
  notes: TargetNote[];
  currentIndex?: number;
  mode?: "stream" | "sheet";
  feedback?: "correct" | "incorrect" | null;
  onReady?: () => void;
  /** Stream only: take the container's height and scale the notation to match. */
  fill?: boolean;
  className?: string;
}

interface StreamGeometry {
  lead: number;
  trail: number;
  playheadX: number;
  spacing: number;
}

/**
 * Reading runs left to right, so the note stream travels right to left: upcoming
 * notes enter from the right edge and the answered ones exit past the clef.
 */
function streamGeometry(width: number): StreamGeometry {
  const lead = width < 520 ? 4 : width < 720 ? 5 : 6;
  const playheadX = Math.max(96, Math.round(width * 0.26));
  return {
    lead,
    trail: width < 520 ? 1 : 2,
    playheadX,
    spacing: Math.max(52, Math.min(116, Math.round((width - playheadX - 20) / lead))),
  };
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
  mode = "stream",
  feedback,
  onReady,
  fill = false,
  className,
}: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staffLayerRef = useRef<HTMLDivElement>(null);
  const streamLayerRef = useRef<HTMLDivElement>(null);
  const sheetLayerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const drawnIndexRef = useRef(-1);
  const slideRef = useRef<Animation | null>(null);
  const [width, setWidth] = useState(mode === "stream" ? 720 : 1050);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [compactLandscape, setCompactLandscape] = useState(false);
  // Read back from the drawn note rather than recomputed, so the marker tracks
  // the head through VexFlow's own stave and formatter offsets.
  const [headCenterX, setHeadCenterX] = useState<number | null>(null);

  const geometry = useMemo(() => streamGeometry(width), [width]);
  const filling = fill && mode === "stream" && availableHeight > 0;
  const staffHeight = filling ? availableHeight : compactLandscape ? 118 : 150;
  const scale = filling
    ? Math.min(MAX_FILL_SCALE, Math.max(1, staffHeight / BASE_STREAM_HEIGHT))
    : 1;
  // Work in the scaled-down coordinate space, then centre the stave so both
  // ledger directions get equal room.
  const innerWidth = width / scale;
  const staveY = Math.round((staffHeight / scale - STAVE_LINES_PX) / 2) - SPACE_ABOVE_STAVE_PX;

  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, Math.floor(entry.contentRect.width)));
      setAvailableHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(orientation: landscape) and (min-width: 700px) and (max-height: 600px)");
    const update = () => setCompactLandscape(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Staff lines and clef stay still while the notes slide past them.
  useEffect(() => {
    const layer = staffLayerRef.current;
    if (mode !== "stream" || !layer) return;
    layer.replaceChildren();
    const renderer = new Renderer(layer, Renderer.Backends.SVG);
    renderer.resize(width, staffHeight);
    const context = renderer.getContext();
    context.scale(scale, scale);
    context.setFillStyle(INK);
    context.setStrokeStyle(INK);
    new Stave(8, staveY, innerWidth - 16).addClef("treble").setContext(context).draw();
  }, [innerWidth, mode, scale, staffHeight, staveY, width]);

  useEffect(() => {
    const layer = streamLayerRef.current;
    if (mode !== "stream" || !layer || notes.length === 0) return;
    const { lead, trail, playheadX, spacing } = geometry;
    layer.replaceChildren();
    const renderer = new Renderer(layer, Renderer.Backends.SVG);
    renderer.resize(playheadX + (lead + 1) * spacing + 40, staffHeight);
    const context = renderer.getContext();
    context.scale(scale, scale);
    // Notes need a stave to place their heads; the visible one lives in the static layer.
    const stave = new Stave(8, staveY, innerWidth - 16);
    // VexFlow offsets every note by the stave's note-start position, so cancel it out
    // to land note heads exactly on the positions this layout computed.
    const originX = stave.getNoteStartX();

    const first = Math.max(0, currentIndex - trail);
    const last = Math.min(notes.length - 1, currentIndex + lead);
    let currentNote: StaveNote | null = null;
    for (let index = first; index <= last; index += 1) {
      const color =
        index < currentIndex
          ? STREAM_PLAYED
          : index > currentIndex
            ? INK
            : feedback === "correct"
              ? CORRECT
              : feedback === "incorrect"
                ? INCORRECT
                : INK;
      const vexNote = createVexNote(notes[index], color);
      vexNote.setStave(stave).setContext(context);
      new TickContext()
        .addTickable(vexNote)
        .preFormat()
        .setX((playheadX + (index - currentIndex) * spacing) / scale - originX);
      vexNote.draw();
      if (index === currentIndex) currentNote = vexNote;
    }
    if (currentNote) {
      const note: StaveNote = currentNote;
      setHeadCenterX((note.getAbsoluteX() + note.getGlyphWidth() / 2) * scale);
    }

    // The layer rests at the drawn position, so advancing only needs to replay the
    // gap the notes just closed.
    const previous = drawnIndexRef.current;
    drawnIndexRef.current = currentIndex;
    if (previous >= 0 && currentIndex > previous && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      slideRef.current?.cancel();
      slideRef.current = layer.animate(
        [{ transform: `translateX(${(currentIndex - previous) * spacing}px)` }, { transform: "translateX(0px)" }],
        { duration: SLIDE_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      );
    }

    const frame = requestAnimationFrame(() => readyRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [currentIndex, feedback, geometry, innerWidth, mode, notes, scale, staffHeight, staveY]);

  useEffect(() => {
    const layer = sheetLayerRef.current;
    if (mode !== "sheet" || !layer || notes.length === 0) return;
    layer.replaceChildren();
    const measureCount = Math.ceil(notes.length / 4);
    const measuresPerRow = width < 520 ? 1 : width < 680 ? 2 : 4;
    const rowHeight = compactLandscape ? 104 : 130;
    const rowCount = Math.ceil(measureCount / measuresPerRow);
    const renderer = new Renderer(layer, Renderer.Backends.SVG);
    renderer.resize(width, rowCount * rowHeight + 8);
    const context = renderer.getContext();
    context.setFillStyle(INK);
    context.setStrokeStyle(INK);

    const usableWidth = width - 28;
    const measureWidth = usableWidth / Math.min(measuresPerRow, measureCount);
    for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
      const start = measureIndex * 4;
      const targets = notes.slice(start, start + 4);
      const rowIndex = Math.floor(measureIndex / measuresPerRow);
      const columnIndex = measureIndex % measuresPerRow;
      const startsRow = columnIndex === 0;
      const stave = new Stave(
        14 + columnIndex * measureWidth,
        (compactLandscape ? 10 : 18) + rowIndex * rowHeight,
        measureWidth,
      );
      if (startsRow) stave.addClef("treble");
      if (measureIndex === 0) stave.addTimeSignature("4/4");
      stave.setContext(context).draw();
      const vexNotes = targets.map((target, localIndex) => {
        const index = start + localIndex;
        const color =
          index === currentIndex
            ? feedback === "incorrect"
              ? INCORRECT
              : CORRECT
            : index < currentIndex
              ? SHEET_PLAYED
              : INK;
        return createVexNote(target, color);
      });
      const voice = new Voice({ numBeats: targets.length, beatValue: 4 }).addTickables(vexNotes);
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(80, measureWidth - (startsRow ? (measureIndex === 0 ? 86 : 64) : 34)));
      voice.draw(context, stave);
    }

    const frame = requestAnimationFrame(() => readyRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [compactLandscape, currentIndex, feedback, mode, notes, width]);

  return (
    <div
      ref={containerRef}
      style={mode === "stream" && !fill ? { height: staffHeight } : undefined}
      className={`music-staff relative w-full overflow-hidden rounded-xl bg-white/95 ${mode === "sheet" ? "min-h-45" : fill ? "h-full" : ""} ${className ?? ""}`}
      aria-label={
        mode === "stream"
          ? `Treble-clef note stream, note ${currentIndex + 1}`
          : `Sheet music, note ${currentIndex + 1} of ${notes.length}`
      }
    >
      {mode === "stream" ? (
        <>
          <div ref={staffLayerRef} className="staff-layer" />
          <div
            className="staff-playhead"
            style={{
              left: (headCenterX ?? geometry.playheadX) - geometry.spacing * 0.34,
              width: geometry.spacing * 0.68,
            }}
          />
          <div className="staff-stream-window">
            <div ref={streamLayerRef} className="staff-layer" />
          </div>
        </>
      ) : (
        <div ref={sheetLayerRef} />
      )}
    </div>
  );
}
