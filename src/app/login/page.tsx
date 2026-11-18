import { AuthForm } from "@/components/auth/AuthForm";
import { isAuthConfigured, safeNextPath } from "@/lib/auth";

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <AuthForm redirectTo={safeNextPath(params.next)} configured={isAuthConfigured()} />;
}
