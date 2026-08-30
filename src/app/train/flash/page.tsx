import type { Metadata } from "next";
import { NoteTrainer } from "@/components/training/NoteTrainer";

export const metadata: Metadata = { title: "Flash Trainer" };

export default function FlashPage() {
  return <NoteTrainer mode="flash" />;
}
