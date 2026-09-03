import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { Providers } from "@/components/Providers";
import { siteUrl } from "@/lib/siteUrl";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sight Reading Trainer", template: "%s · Sight Reading Trainer" },
  description: "Build fast, accurate piano sight-reading reflexes.",
  applicationName: "Sight Reading Trainer",
  icons: {
    icon: [
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  appleWebApp: { capable: true, title: "Sight Reader", statusBarStyle: "black-translucent" },
  // Chat apps read Open Graph and resolve nothing themselves, so the origin has
  // to be stated for the image URL to survive as an absolute one.
  metadataBase: new URL(siteUrl()),
  openGraph: {
    type: "website",
    siteName: "Sight Reading Trainer",
    title: "See the note. Play it without thinking.",
    description: "Piano sight-reading practice with a real MIDI keyboard.",
    url: "/",
    images: [{
      url: "/og.png",
      width: 1200,
      height: 630,
      type: "image/png",
      alt: "A treble clef beside the words: see the note, play it without thinking.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "See the note. Play it without thinking.",
    description: "Piano sight-reading practice with a real MIDI keyboard.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AppNav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
