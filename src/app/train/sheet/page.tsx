import type { Metadata } from "next";
import { SheetTrainer } from "@/components/training/SheetTrainer";

export const metadata: Metadata = { title: "Sheet Reading" };

export default function SheetPage() {
  return <SheetTrainer />;
}
