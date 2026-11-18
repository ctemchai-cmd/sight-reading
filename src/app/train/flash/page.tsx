import type { Metadata } from "next";
import { Suspense } from "react";
import { NoteTrainer } from "@/components/training/NoteTrainer";

export const metadata: Metadata = { title: "Flash Trainer" };

export default function FlashPage() {
  // The trainer reads a coach link's focus pitches from the query string.
  return (
    <Suspense>
      <NoteTrainer mode="flash" />
    </Suspense>
  );
}
