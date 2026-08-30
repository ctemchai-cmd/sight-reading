import { describe, expect, it } from "vitest";
import { isPermanentRejection } from "@/lib/sessionPersistence";

describe("deciding whether a rejected save is worth retrying", () => {
  it("gives up on data and integrity errors, which describe the row itself", () => {
    // A value outside a check constraint — a mode or clef a migration has not
    // widened yet — is the case this exists for.
    expect(isPermanentRejection({ code: "23514" })).toBe(true);
    expect(isPermanentRejection({ code: "23502" })).toBe(true);
    expect(isPermanentRejection({ code: "23503" })).toBe(true);
    expect(isPermanentRejection({ code: "22P02" })).toBe(true);
  });

  it("keeps waiting on anything that might pass later", () => {
    expect(isPermanentRejection({ code: "PGRST301" })).toBe(false); // expired token
    expect(isPermanentRejection({ code: "42501" })).toBe(false); // row-level security
    expect(isPermanentRejection(new TypeError("Failed to fetch"))).toBe(false);
    expect(isPermanentRejection(null)).toBe(false);
    expect(isPermanentRejection(undefined)).toBe(false);
    expect(isPermanentRejection({ code: 23514 })).toBe(false); // not a string
  });
});
