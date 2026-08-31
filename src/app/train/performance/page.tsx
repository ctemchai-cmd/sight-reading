import type { Metadata } from "next";
import { Suspense } from "react";
import { NoteTrainer } from "@/components/training/NoteTrainer";

export const metadata: Metadata = { title: "Performance Trainer" };

export default function PerformancePage() {
  // The trainer reads the dashboard's focus pitches from the query string.
  return (
    <Suspense>
      <NoteTrainer mode="performance" />
    </Suspense>
  );
}
