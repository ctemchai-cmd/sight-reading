"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Accidental as VexAccidental,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  TickContext,
  Voice,
} from "vexflow";
import { isAccidentalImplied } from "@/core/music/keys";
import { accidentalToVexFlow, formatClef, notationToVexFlowKey } from "@/core/music/notes";
import { performanceBeatProgress } from "@/core/training/performance";
import type { Clef, KeyName, TargetNote } from "@/types/music";
import type { PerformanceFeedbackEvent, PerformanceFeedbackKind } from "@/types/training";

// The notation surface remains paper-white in every app theme, so musical ink stays dark.
const INK = "#0f172a";
const CORRECT = "#2dd4bf";
const INCORRECT = "#fb7185";
const PERFORMANCE_CORRECT = "#38bdf8";
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
/**
 * Sheet music is drawn at a fixed size by VexFlow, which reads small on a
 * tablet held at arm's length. How far it can grow is set by how much room a
 * measure needs before its notes collide, and by how much height is going
 * spare — four measures across a row is the real ceiling here.
 */
const SHEET_MIN_MEASURE_PX = 150;
const MAX_SHEET_SCALE = 2;
const PERFORMANCE_FEEDBACK_LABELS: Record<PerformanceFeedbackKind, string> = {
  perfect: "Perfect",
  great: "Great",
  cool: "Cool",
  bad: "Bad",
  miss: "Miss",
  wrong: "Wrong",
};

interface MusicStaffProps {
  notes: TargetNote[];
  currentIndex?: number;
  mode?: "stream" | "flash" | "sheet";
  keySignature?: KeyName;
  clef?: Clef;
  feedback?: "correct" | "incorrect" | null;
  /** Sheet only: mark the note whose beat is active without moving the notation. */
  beatCursor?: boolean;
  beatCursorRunning?: boolean;
  beatDurationMs?: number;
  beatStartedAtMs?: number;
  performanceFeedback?: PerformanceFeedbackEvent | null;
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

interface CursorGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Reading runs left to right, so the note stream travels right to left: upcoming
 * notes enter from the right edge and the answered ones exit past the clef.
 * Flash mode is the degenerate case — no lookahead, no history, one centred note.
 */
function streamGeometry(width: number, flash: boolean, noteStartX: number): StreamGeometry {
  if (flash) return { lead: 0, trail: 0, playheadX: Math.round(width / 2), spacing: 0 };
  const lead = width < 520 ? 4 : width < 720 ? 5 : 6;
  const playheadX = Math.max(96, noteStartX + 16, Math.round(width * 0.26));
  return {
    lead,
    trail: width < 520 ? 1 : 2,
    playheadX,
    spacing: Math.max(52, Math.min(116, Math.round((width - playheadX - 20) / lead))),
  };
}

function createVexNote(target: TargetNote, color: string, keySignature: KeyName, clef: Clef): StaveNote {
  const note = new StaveNote({
    clef,
    keys: [notationToVexFlowKey(target.notation)],
    duration: "q",
    autoStem: true,
  });
  // An accidental the key signature already carries is not written on the head:
  // reading it from the signature instead is the point of practising in a key.
  const accidental = isAccidentalImplied(keySignature, target.notation)
    ? null
    : accidentalToVexFlow(target.notation);
  if (accidental) note.addModifier(new VexAccidental(accidental), 0);
  note.setStyle({ fillStyle: color, strokeStyle: color });
  note.setLedgerLineStyle({ fillStyle: color, strokeStyle: color });
  return note;
}

function paintVexElement(element: SVGElement, color: string): void {
  const nodes = [element, ...Array.from(element.querySelectorAll<SVGElement>("*"))];
  for (const node of nodes) {
    node.style.setProperty("fill", color, "important");
    node.style.setProperty("stroke", color, "important");
  }
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function MusicStaff({
  notes,
  currentIndex = 0,
  mode = "stream",
  keySignature = "C",
  clef = "treble",
  feedback,
  beatCursor = false,
  beatCursorRunning = false,
  beatDurationMs = 0,
  beatStartedAtMs = 0,
  performanceFeedback = null,
  onReady,
  fill = false,
  className,
}: MusicStaffProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staffLayerRef = useRef<HTMLDivElement>(null);
  const streamLayerRef = useRef<HTMLDivElement>(null);
  const sheetLayerRef = useRef<HTMLDivElement>(null);
  const sheetCursorRef = useRef<HTMLDivElement>(null);
  const sheetNoteElementsRef = useRef<Array<SVGElement | null>>([]);
  const paintedPerformanceNoteRef = useRef<number | null>(null);
  const readyRef = useRef(onReady);
  const drawnIndexRef = useRef(-1);
  const slideRef = useRef<Animation | null>(null);
  const [width, setWidth] = useState(mode === "stream" ? 720 : 1050);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [compactLandscape, setCompactLandscape] = useState(false);
  // Read back from the drawn note rather than recomputed, so the marker tracks
  // the head through VexFlow's own stave and formatter offsets.
  const [headCenterX, setHeadCenterX] = useState<number | null>(null);
  // Where notes may start: past the clef and whatever the key signature draws.
  const [noteStartX, setNoteStartX] = useState(0);
  const [sheetCursorPositions, setSheetCursorPositions] = useState<CursorGeometry[]>([]);

  const streaming = mode === "stream" || mode === "flash";
  const geometry = useMemo(() => streamGeometry(width, mode === "flash", noteStartX), [mode, noteStartX, width]);
  const filling = fill && streaming && availableHeight > 0;
  const staffHeight = filling ? availableHeight : compactLandscape ? 118 : 150;
  const scale = filling
    ? Math.min(MAX_FILL_SCALE, Math.max(1, staffHeight / BASE_STREAM_HEIGHT))
    : 1;
  // Work in the scaled-down coordinate space, then centre the stave so both
  // ledger directions get equal room.
  const innerWidth = width / scale;
  const staveY = Math.round((staffHeight / scale - STAVE_LINES_PX) / 2) - SPACE_ABOVE_STAVE_PX;
  const sheetRenderIndex = beatCursor ? -1 : currentIndex;
  const sheetRenderFeedback = beatCursor ? null : feedback;

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
    if (!streaming || !layer) return;
    layer.replaceChildren();
    const renderer = new Renderer(layer, Renderer.Backends.SVG);
    renderer.resize(width, staffHeight);
    const context = renderer.getContext();
    context.scale(scale, scale);
    context.setFillStyle(INK);
    context.setStrokeStyle(INK);
    const stave = new Stave(8, staveY, innerWidth - 16).addClef(clef).addKeySignature(keySignature);
    stave.setContext(context).draw();
    setNoteStartX(stave.getNoteStartX() * scale);
  }, [clef, innerWidth, keySignature, scale, staffHeight, staveY, streaming, width]);

  useEffect(() => {
    const layer = streamLayerRef.current;
    if (!streaming || !layer || notes.length === 0) return;
    const { lead, trail, playheadX, spacing } = geometry;
    layer.replaceChildren();
    const renderer = new Renderer(layer, Renderer.Backends.SVG);
    renderer.resize(Math.max(width, playheadX + (lead + 1) * spacing + 120), staffHeight);
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
      const vexNote = createVexNote(notes[index], color, keySignature, clef);
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
    if (mode === "stream" && previous >= 0 && currentIndex > previous && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      slideRef.current?.cancel();
      slideRef.current = layer.animate(
        [{ transform: `translateX(${(currentIndex - previous) * spacing}px)` }, { transform: "translateX(0px)" }],
        { duration: SLIDE_MS, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
      );
    }

    const frame = requestAnimationFrame(() => readyRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [clef, currentIndex, feedback, geometry, innerWidth, keySignature, mode, notes, scale, staffHeight, staveY, streaming, width]);

  useEffect(() => {
    const layer = sheetLayerRef.current;
    if (mode !== "sheet" || !layer || notes.length === 0) return;
    layer.replaceChildren();
    const measureCount = Math.ceil(notes.length / 4);
    const measuresPerRow = width < 520 ? 1 : width < 680 ? 2 : 4;
    const rowHeight = compactLandscape ? 104 : 130;
    const rowCount = Math.ceil(measureCount / measuresPerRow);
    const naturalHeight = rowCount * rowHeight + 8;
    // Compact landscape has no spare height by construction — everything on that
    // layout already barely fits — so it keeps the drawn size it was tuned at.
    const heightBudget = compactLandscape ? naturalHeight : window.innerHeight * (fill ? 0.6 : 0.42);
    const sheetScale = Math.min(
      MAX_SHEET_SCALE,
      width / SHEET_MIN_MEASURE_PX / measuresPerRow,
      heightBudget / naturalHeight,
    );
    const scale = Math.max(1, sheetScale);
    const renderer = new Renderer(layer, Renderer.Backends.SVG);
    renderer.resize(width, Math.round(naturalHeight * scale));
    const context = renderer.getContext();
    context.scale(scale, scale);
    context.setFillStyle(INK);
    context.setStrokeStyle(INK);

    const usableWidth = width / scale - 28;
    const topOffset = compactLandscape ? 10 : 18;

    // A clef, key signature and time signature eat into the measure that carries
    // them. Ask each stave how much it takes rather than guessing, then hand
    // every measure in the row the same amount of room for its notes — otherwise
    // the first one crams four notes into whatever the signature left behind.
    const staves = Array.from({ length: measureCount }, (_, measureIndex) => {
      const stave = new Stave(0, 0, usableWidth);
      if (measureIndex % measuresPerRow === 0) stave.addClef(clef).addKeySignature(keySignature);
      if (measureIndex === 0) stave.addTimeSignature("4/4");
      return stave.setContext(context);
    });
    const prefixes = staves.map((stave) => stave.getNoteStartX() - stave.getX());
    const cursorPositions: CursorGeometry[] = [];
    const noteElements: Array<SVGElement | null> = [];

    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const firstInRow = rowIndex * measuresPerRow;
      const inRow = Math.min(measuresPerRow, measureCount - firstInRow);
      const rowPrefix = prefixes.slice(firstInRow, firstInRow + inRow).reduce((sum, px) => sum + px, 0);
      const noteSpace = (usableWidth - rowPrefix) / inRow;
      let x = 14;

      for (let column = 0; column < inRow; column += 1) {
        const measureIndex = firstInRow + column;
        const start = measureIndex * 4;
        const targets = notes.slice(start, start + 4);
        const stave = staves[measureIndex];
        stave.setX(x).setY(topOffset + rowIndex * rowHeight).setWidth(prefixes[measureIndex] + noteSpace);
        stave.draw();

        const vexNotes = targets.map((target, localIndex) => {
          const index = start + localIndex;
          const color =
            index === sheetRenderIndex
              ? sheetRenderFeedback === "incorrect"
                ? INCORRECT
                : sheetRenderFeedback === "correct"
                  ? CORRECT
                  : INK
              : index < sheetRenderIndex
                ? SHEET_PLAYED
                : INK;
          return createVexNote(target, color, keySignature, clef);
        });
        const voice = new Voice({ numBeats: targets.length, beatValue: 4 }).addTickables(vexNotes);
        new Formatter().joinVoices([voice]).format([voice], Math.max(60, noteSpace - 14));
        voice.draw(context, stave);
        if (beatCursor) {
          for (let localIndex = 0; localIndex < vexNotes.length; localIndex += 1) {
            const index = start + localIndex;
            const note = vexNotes[localIndex];
            const element = note.getSVGElement() ?? null;
            element?.setAttribute("data-performance-note-index", String(index));
            noteElements[index] = element;
            const cursorWidth = Math.min(42, Math.max(24, noteSpace * 0.18));
            const top = stave.getYForLine(0) - 16;
            cursorPositions[index] = {
              left: (note.getAbsoluteX() + note.getGlyphWidth() / 2 - cursorWidth / 2) * scale,
              top: top * scale,
              width: cursorWidth * scale,
              height: (stave.getYForLine(4) - top + 16) * scale,
            };
            // The final note needs somewhere to travel during its own beat.
            // Without this off-score destination the cursor reached the last
            // head one beat early and appeared to wait there before page turn.
            if (index === notes.length - 1) {
              cursorPositions[notes.length] = {
                ...cursorPositions[index],
                left: Math.max(
                  cursorPositions[index].left + cursorWidth * 0.6 * scale,
                  (stave.getX() + stave.getWidth() - cursorWidth - 8) * scale,
                ),
              };
            }
          }
        }
        x += prefixes[measureIndex] + noteSpace;
      }
    }

    sheetNoteElementsRef.current = noteElements;
    paintedPerformanceNoteRef.current = null;
    setSheetCursorPositions(cursorPositions);

    // Several systems will not fit at once, so keep Sheet Reading's current
    // line in view. Performance owns a separate lightweight cursor below.
    const view = containerRef.current;
    if (view && !beatCursor) {
      const rowTop = (topOffset + Math.floor(Math.floor(sheetRenderIndex / 4) / measuresPerRow) * rowHeight) * scale;
      const rowBottom = rowTop + rowHeight * scale;
      if (rowTop < view.scrollTop) view.scrollTop = Math.max(0, rowTop - 6);
      else if (rowBottom > view.scrollTop + view.clientHeight) {
        view.scrollTop = rowBottom - view.clientHeight + 6;
      }
    }

    const frame = requestAnimationFrame(() => readyRef.current?.());
    return () => cancelAnimationFrame(frame);
  }, [beatCursor, clef, compactLandscape, fill, keySignature, mode, notes, sheetRenderFeedback, sheetRenderIndex, width]);

  const sheetCursor = sheetCursorPositions[currentIndex] ?? null;
  const nextSheetCursor = sheetCursorPositions[currentIndex + 1] ?? null;
  const performanceFeedbackGeometry = performanceFeedback
    ? sheetCursorPositions[performanceFeedback.noteIndex] ?? null
    : null;

  useEffect(() => {
    if (!beatCursor) return;
    const previousIndex = paintedPerformanceNoteRef.current;
    if (previousIndex !== null) {
      const previous = sheetNoteElementsRef.current[previousIndex];
      if (previous) paintVexElement(previous, INK);
    }
    if (!performanceFeedback) {
      paintedPerformanceNoteRef.current = null;
      return;
    }
    const element = sheetNoteElementsRef.current[performanceFeedback.noteIndex];
    if (!element) return;
    const correct = performanceFeedback.kind !== "wrong" && performanceFeedback.kind !== "miss";
    paintVexElement(element, correct ? PERFORMANCE_CORRECT : INCORRECT);
    paintedPerformanceNoteRef.current = performanceFeedback.noteIndex;
  }, [beatCursor, performanceFeedback, sheetCursorPositions]);

  useEffect(() => {
    const cursor = sheetCursorRef.current;
    if (!cursor || !sheetCursor) return;
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (now: number) => {
      const canMove = beatCursorRunning
        && !reducedMotion
        && Boolean(nextSheetCursor)
        && beatDurationMs > 0
        && beatStartedAtMs > 0;
      const progress = canMove
        ? performanceBeatProgress(now, beatStartedAtMs, beatDurationMs)
        : 0;
      const next = nextSheetCursor ?? sheetCursor;
      const left = interpolate(sheetCursor.left, next.left, progress);
      const top = interpolate(sheetCursor.top, next.top, progress);
      cursor.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      cursor.style.width = `${interpolate(sheetCursor.width, next.width, progress)}px`;
      cursor.style.height = `${interpolate(sheetCursor.height, next.height, progress)}px`;
      if (canMove && progress < 1) frame = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => cancelAnimationFrame(frame);
  }, [beatCursorRunning, beatDurationMs, beatStartedAtMs, nextSheetCursor, sheetCursor]);

  useEffect(() => {
    if (!beatCursor || !sheetCursor) return;
    const view = containerRef.current;
    if (!view) return;
    const rowTop = Math.max(0, sheetCursor.top - 18);
    const rowBottom = sheetCursor.top + sheetCursor.height + 18;
    if (rowTop < view.scrollTop) view.scrollTop = rowTop;
    else if (rowBottom > view.scrollTop + view.clientHeight) view.scrollTop = rowBottom - view.clientHeight;
  }, [beatCursor, currentIndex, sheetCursor]);

  return (
    <div
      ref={containerRef}
      style={{
        ...(streaming && !fill ? { height: staffHeight } : {}),
        ...(streaming ? ({ "--staff-fade": `${Math.round(noteStartX)}px` } as CSSProperties) : {}),
      }}
      className={`music-staff relative w-full rounded-xl bg-white/95 ${mode === "sheet" ? "min-h-45 max-h-[55vh] overflow-y-auto overflow-x-hidden" : `overflow-hidden ${fill ? "h-full" : ""}`} ${className ?? ""}`}
      aria-label={
        streaming
          ? `${formatClef(clef)}-clef note ${currentIndex + 1}`
          : `Sheet music, note ${currentIndex + 1} of ${notes.length}`
      }
    >
      {streaming ? (
        <>
          <div ref={staffLayerRef} className="staff-layer" />
          {mode === "stream" && (
          <div
            className="staff-playhead"
            style={{
              left: (headCenterX ?? geometry.playheadX) - geometry.spacing * 0.34,
              width: geometry.spacing * 0.68,
            }}
          />
          )}
          <div className="staff-stream-window">
            <div ref={streamLayerRef} className="staff-layer" />
          </div>
        </>
      ) : (
        <div className="relative">
          {beatCursor && sheetCursor && (
            <div
              ref={sheetCursorRef}
              className="sheet-beat-cursor"
              style={{
                left: 0,
                top: 0,
                width: sheetCursor.width,
                height: sheetCursor.height,
              }}
              aria-hidden="true"
            />
          )}
          <div ref={sheetLayerRef} className="relative z-10" />
          {performanceFeedback && performanceFeedbackGeometry && (
            <span
              key={performanceFeedback.id}
              className={`performance-hit-grade performance-hit-grade-${performanceFeedback.kind}`}
              style={{
                left: performanceFeedbackGeometry.left + performanceFeedbackGeometry.width / 2,
                top: performanceFeedbackGeometry.top + performanceFeedbackGeometry.height * 0.35,
              }}
              aria-hidden="true"
            >
              {PERFORMANCE_FEEDBACK_LABELS[performanceFeedback.kind]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
