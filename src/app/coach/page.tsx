import type { Metadata } from "next";
import { CoachChat } from "@/components/coach/CoachChat";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage() {
  // The header stays to one compact line: at 800x360 a heading and a paragraph
  // left the transcript 18 pixels tall, which is a page that cannot be read.
  // What the coach is, and what leaves the device, are said in the opening card
  // instead — which is where they are read anyway, before the first question.
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <h1 className="shrink-0 text-xl font-bold text-white sm:text-2xl">Practice coach</h1>
      <CoachChat />
    </div>
  );
}
