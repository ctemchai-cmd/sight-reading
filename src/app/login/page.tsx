import { AuthForm } from "@/components/auth/AuthForm";

const errorMessages: Record<string, string> = {
  "supabase-config": "Supabase is not configured for this deployment.",
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
  const fallbackMessage = !supabaseConfigured ? errorMessages["supabase-config"] : undefined;
  return (
    <AuthForm
      redirectTo={redirectTo}
      serverMessage={errorMessages[error] ?? fallbackMessage}
      supabaseConfigured={supabaseConfigured}
    />
  );
}
