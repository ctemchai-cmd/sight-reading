import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "@/lib/siteUrl";

afterEach(() => vi.unstubAllEnvs());

describe("share preview origin", () => {
  it("prefers an explicitly configured origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://trainer.example");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "ignored.vercel.app");
    expect(siteUrl()).toBe("https://trainer.example");
  });

  it("falls back to the production deployment Vercel names", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "trainer.vercel.app");
    expect(siteUrl()).toBe("https://trainer.vercel.app");
  });

  it("falls back to localhost when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  // A trailing slash or a doubled scheme makes the image URL resolve to
  // something no crawler will fetch, and the preview silently becomes a link.
  it("tolerates a trailing slash or a scheme already present", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://trainer.example/");
    expect(siteUrl()).toBe("https://trainer.example");

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "https://trainer.vercel.app/");
    expect(siteUrl()).toBe("https://trainer.vercel.app");
  });

  it("always produces something URL can parse, since metadataBase demands it", () => {
    for (const value of ["", "  ", "https://x.test"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", value);
      expect(() => new URL(siteUrl())).not.toThrow();
    }
  });
});
