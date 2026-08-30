import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sight Reading Trainer",
    short_name: "Sight Reader",
    description: "Piano note recognition and sight-reading practice.",
    start_url: "/train",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#14b8a6",
    orientation: "landscape",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
