"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { MidiProvider } from "@/hooks/useMidi";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <MidiProvider>{children}</MidiProvider>
    </ThemeProvider>
  );
}
