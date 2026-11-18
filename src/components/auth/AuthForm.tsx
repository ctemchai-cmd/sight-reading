"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { logIn } from "@/lib/authActions";

interface AuthFormProps {
  redirectTo: string;
  configured: boolean;
}

export function AuthForm({ redirectTo, configured }: AuthFormProps) {
  const [error, action, busy] = useActionState(logIn, null);
  const message = configured ? error : "APP_PASSWORD is not configured for this deployment.";

  return (
    <div className="auth-page mx-auto max-w-md px-4 py-10 sm:px-6 sm:py-14">
      <div>
        <h1 className="text-3xl font-bold text-white sm:text-4xl">Private access</h1>
        <p className="mt-2 text-sm text-slate-400">Enter the password set by the site owner. Public registration and guest training are disabled.</p>
      </div>
      <Card className="auth-card mt-7 p-4 sm:p-6">
        <form className="auth-form space-y-4" action={action}>
          <input type="hidden" name="next" value={redirectTo} />
          <label className="block text-sm text-slate-300">Password<input required name="password" type="password" autoComplete="current-password" className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
          {message && <p className="rounded-lg bg-slate-950 p-3 text-sm text-amber-200" role="status">{message}</p>}
          <Button className="w-full" type="submit" disabled={busy || !configured}>{busy && <LoaderCircle className="size-4 animate-spin" />}Log in</Button>
        </form>
        <p className="auth-account-note mt-5 text-center text-xs text-slate-500">There are no accounts — one password opens the trainer.</p>
      </Card>
    </div>
  );
}
