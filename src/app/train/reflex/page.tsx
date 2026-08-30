import type { Metadata } from "next";
import { NoteTrainer } from "@/components/training/NoteTrainer";

export const metadata: Metadata = { title: "Reflex Trainer" };

export default function ReflexPage() {
  return <NoteTrainer mode="reflex" />;
}
