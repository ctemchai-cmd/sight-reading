/**
 * When a note counts as read rather than worked out.
 *
 * Under this, recognition is immediate: the eye lands and the hand is already
 * moving. It is a demanding but reachable standard, and the point of an
 * absolute one is that the whole keyboard can eventually be green — a scale
 * measured against the player's own average always leaves half of it red, which
 * hides progress rather than showing it.
 */
export const FLUENT_RESPONSE_MS = 800;
/** Long enough that the note is being deduced, counting lines and spaces. */
export const LABOURED_RESPONSE_MS = 2500;
export const FLUENT_ACCURACY = 0.95;
export const LABOURED_ACCURACY = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 1 when the note is read on sight, 0 when it is worked out. */
export function responseFluency(medianResponseMs: number): number {
  if (medianResponseMs <= 0) return 0;
  return clamp01((LABOURED_RESPONSE_MS - medianResponseMs) / (LABOURED_RESPONSE_MS - FLUENT_RESPONSE_MS));
}

export function accuracyFluency(firstTryAccuracy: number): number {
  return clamp01((firstTryAccuracy - LABOURED_ACCURACY) / (FLUENT_ACCURACY - LABOURED_ACCURACY));
}

const RED = [239, 68, 68] as const;
const AMBER = [245, 158, 11] as const;
const GREEN = [34, 197, 94] as const;

function mix(from: readonly number[], to: readonly number[], amount: number): number[] {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));
}

/** Red through amber to green, so the middle of the range is legible too. */
export function fluencyColor(fluency: number, alpha = 1): string {
  const value = clamp01(fluency);
  const [r, g, b] = value < 0.5 ? mix(RED, AMBER, value * 2) : mix(AMBER, GREEN, (value - 0.5) * 2);
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}
