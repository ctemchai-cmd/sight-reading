import type { Metadata } from "next";
import { NoteTrainer } from "@/components/training/NoteTrainer";

export const metadata: Metadata = { title: "Performance Trainer" };

export default function PerformancePage() {
  return <NoteTrainer mode="performance" />;
}
