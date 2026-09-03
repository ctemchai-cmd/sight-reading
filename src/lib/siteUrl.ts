const LOCAL_URL = "http://localhost:3000";

/**
 * The origin a share preview points at.
 *
 * Link previews are fetched by someone else's crawler, so every URL in the
 * metadata has to be absolute — a relative one is simply dropped, and the
 * preview arrives as a bare link. `NEXT_PUBLIC_SITE_URL` is the answer when
 * there is a custom domain; otherwise Vercel names the production deployment
 * itself, which is the one worth sharing even when a preview build renders the
 * tags.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  return vercel ? `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : LOCAL_URL;
}
