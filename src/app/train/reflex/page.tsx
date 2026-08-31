import type { Metadata } from "next";
import { Suspense } from "react";
import { NoteTrainer } from "@/components/training/NoteTrainer";

export const metadata: Metadata = { title: "Reflex Trainer" };

export default function ReflexPage() {
  // The trainer reads the dashboard's focus pitches from the query string.
  return (
    <Suspense>
      <NoteTrainer mode="reflex" />
    </Suspense>
  );
}
