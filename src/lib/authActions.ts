"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, passwordMatches, safeNextPath, sessionToken } from "@/lib/auth";

export async function logIn(_previous: string | null, formData: FormData): Promise<string | null> {
  const token = sessionToken();
  if (!token) return "APP_PASSWORD is not configured for this deployment.";
  const password = formData.get("password");
  if (typeof password !== "string" || !passwordMatches(password)) return "That password is not right.";

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
