/**
 * When a note counts as read rather than worked out.
 *
 * Under this, recognition is immediate: the eye lands and the hand is already
 * moving. It is a demanding but reachable standard, and an absolute one means
 * progress is visible — a scale measured against the player's own average moves
 * with them and hides it.
 */
export const FLUENT_RESPONSE_MS = 800;
/** Long enough that the note is being deduced, counting lines and spaces. */
export const LABOURED_RESPONSE_MS = 2500;
export const FLUENT_ACCURACY = 0.95;
export const LABOURED_ACCURACY = 0.5;
