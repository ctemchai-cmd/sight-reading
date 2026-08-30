import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Progress" };
export default function DashboardPage() { return <Dashboard />; }
