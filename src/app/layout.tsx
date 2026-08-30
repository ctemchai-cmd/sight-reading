import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppNav } from "@/components/AppNav";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sight Reading Trainer", template: "%s · Sight Reading Trainer" },
  description: "Build fast, accurate piano sight-reading reflexes.",
  applicationName: "Sight Reading Trainer",
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
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
