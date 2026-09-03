import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sight Reading Trainer",
    short_name: "Sight Reader",
    description: "Piano note recognition and sight-reading practice.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#14b8a6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The artwork sits inside the middle 80% a maskable icon is allowed to
      // count on, and its background reaches every corner, so one file serves
      // both purposes: a circular mask trims decoration, never the subject.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
