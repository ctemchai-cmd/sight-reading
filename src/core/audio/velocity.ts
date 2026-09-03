/**
 * How hard a key was struck, turned into how loud the sample plays.
 *
 * Velocity is not amplitude. Halving MIDI velocity should sound roughly half as
 * loud, and loudness follows amplitude by something closer to a square law, so
 * passing velocity/127 straight through — as this did — made everything sit in
 * the top of its range and flattened the difference between a soft touch and a
 * hard one.
 */
const CURVE = 2;
/** Even the lightest touch has to sound, or a real keyboard's quietest notes vanish. */
const FLOOR = 0.06;

export function velocityToGain(velocity: number): number {
  const normalised = Math.min(1, Math.max(0, velocity / 127));
  return FLOOR + (1 - FLOOR) * normalised ** CURVE;
}

/** The velocity a fixed-force input reports, loud enough to hear but not the ceiling. */
export const DEFAULT_VELOCITY = 96;

/**
 * Velocity from where a finger landed on the key.
 *
 * A touchscreen reports no force worth trusting — `pressure` is a constant on
 * most finger input — so the key is read like a real one instead: the further
 * down the key, the more leverage, the louder the note.
 */
export function velocityFromKeyPosition(offsetY: number, keyHeight: number): number {
  if (!Number.isFinite(offsetY) || !Number.isFinite(keyHeight) || keyHeight <= 0) return DEFAULT_VELOCITY;
  const depth = Math.min(1, Math.max(0, offsetY / keyHeight));
  return Math.round(52 + depth * 75);
}
