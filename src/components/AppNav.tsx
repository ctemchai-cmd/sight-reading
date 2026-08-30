"use client";

import { BarChart3, Home, Music2, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/train", label: "Train", icon: Music2 },
  { href: "/dashboard", label: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6" aria-label="Main navigation">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white">
          <span className="grid size-9 place-items-center rounded-xl bg-teal-400 text-slate-950">SR</span>
          <span className="hidden sm:inline">Sight Reading Trainer</span>
        </Link>
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
