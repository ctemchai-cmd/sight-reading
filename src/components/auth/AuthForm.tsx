"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase is not configured. Add the Vercel environment variables first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else { router.push("/dashboard"); router.refresh(); }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { display_name: displayName } },
      });
      setMessage(error?.message ?? "Check your email to confirm the account.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-md px-6 py-14">
      <h1 className="text-3xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create an account"}</h1>
      <p className="mt-2 text-sm text-slate-400">Practice remains available without an account. Sign in to sync progress through Supabase.</p>
      <Card className="mt-7 p-6">
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {mode === "signup" && <label className="block text-sm text-slate-300">Display name<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>}
          <label className="block text-sm text-slate-300">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
          {message && <p className="rounded-lg bg-slate-950 p-3 text-sm text-amber-200" role="status">{message}</p>}
          <Button className="w-full" type="submit" disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />}{mode === "login" ? "Log in" : "Sign up"}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-400">{mode === "login" ? "Need an account?" : "Already registered?"} <Link className="font-semibold text-teal-300" href={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Sign up" : "Log in"}</Link></p>
      </Card>
    </div>
  );
}
