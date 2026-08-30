import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA manifest", () => {
  it("takes its identity from the launch URL and covers the full app scope", () => {
    const value = manifest();

    // No explicit id: the identity is the start URL, so the two cannot drift apart.
    expect(value.id).toBeUndefined();
    expect(value.start_url).toBe("/");
    expect(value.scope).toBe("/");
    expect(value.display).toBe("standalone");
    // Android bakes `orientation` into the minted package's activity. Declaring
    // one made this the only installed app on the test device that would not
    // launch from its home screen icon, so the device decides rotation.
    expect(value.orientation).toBeUndefined();
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]));
  });
});
