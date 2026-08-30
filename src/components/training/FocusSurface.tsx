"use client";

import { Minimize2 } from "lucide-react";
import type { ReactNode } from "react";

interface FocusSurfaceProps {
  active: boolean;
  onExit: () => void;
  /** Layout classes used when focus mode is off; the surface supplies its own. */
  className: string;
  children: ReactNode;
}

/**
 * Gives the whole viewport to the notation and the keyboard. Everything the
 * trainers render outside those two is expected to hide itself while active,
 * leaving this small overlay as the way back out.
 */
export function FocusSurface({ active, onExit, className, children }: FocusSurfaceProps) {
  if (!active) return <div className={className}>{children}</div>;

  return (
    <div className="focus-training-surface">
      <button
        type="button"
        onClick={onExit}
        className="focus-exit-button inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 opacity-55 transition hover:text-white hover:opacity-100 focus-visible:text-white focus-visible:opacity-100"
      >
        <Minimize2 className="size-3.5" aria-hidden="true" /> Exit focus
      </button>
      {children}
    </div>
  );
}
