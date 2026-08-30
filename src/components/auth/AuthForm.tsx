"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthFormProps {
  redirectTo: string;
  serverMessage?: string;
  supabaseConfigured: boolean;
}

export function AuthForm({ redirectTo, serverMessage, supabaseConfigured }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(serverMessage ?? null);
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
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else {
      router.push(redirectTo);
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-md px-6 py-14">
      <h1 className="text-3xl font-bold text-white">Private access</h1>
      <p className="mt-2 text-sm text-slate-400">Sign in with an account created by the site owner in Supabase. Public registration and guest training are disabled.</p>
      <Card className="mt-7 p-6">
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm text-slate-300">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
          <label className="block text-sm text-slate-300">Password<input required minLength={8} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
          {message && <p className="rounded-lg bg-slate-950 p-3 text-sm text-amber-200" role="status">{message}</p>}
          <Button className="w-full" type="submit" disabled={busy || !supabaseConfigured}>{busy && <LoaderCircle className="size-4 animate-spin" />}Log in</Button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">Accounts are created and approved by the site owner in Supabase.</p>
      </Card>
    </div>
  );
}
