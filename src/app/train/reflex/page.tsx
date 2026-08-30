import type { Metadata } from "next";
import { ReflexTrainer } from "@/components/training/ReflexTrainer";

export const metadata: Metadata = { title: "Reflex Trainer" };

export default function ReflexPage() {
  return <ReflexTrainer />;
}
