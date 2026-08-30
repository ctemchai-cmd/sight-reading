import { AuthForm } from "@/components/auth/AuthForm";

const errorMessages: Record<string, string> = {
  "invite-only": "Public sign-up is disabled. Use an account created by the site owner.",
  "supabase-config": "Supabase is not configured for this deployment.",
  "access-config": "Set PRIVATE_ALLOWED_EMAILS in Vercel before signing in.",
  unauthorized: "This email is not approved for this private app.",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedPath = typeof params.next === "string" ? params.next : "/train";
  const redirectTo = requestedPath.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/train";
  const error = typeof params.error === "string" ? params.error : "";
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const allowlistConfigured = (process.env.PRIVATE_ALLOWED_EMAILS ?? "")
    .split(",")
    .some((email) => email.trim().length > 0);
  const fallbackMessage = !supabaseConfigured
    ? errorMessages["supabase-config"]
    : !allowlistConfigured
      ? errorMessages["access-config"]
      : undefined;
  return (
    <AuthForm
      redirectTo={redirectTo}
      serverMessage={errorMessages[error] ?? fallbackMessage}
      accessConfigured={supabaseConfigured && allowlistConfigured}
    />
  );
}
