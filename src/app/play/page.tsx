import type { Metadata } from "next";
import { FreePlay } from "@/components/play/FreePlay";

export const metadata: Metadata = { title: "Free play" };

export default function PlayPage() {
  return <FreePlay />;
}
