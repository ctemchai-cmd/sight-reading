# Sight Reading Trainer

A Chrome Desktop-first piano sight-reading trainer built with Next.js, VexFlow, Tone.js, Web MIDI, and Supabase.

## Deploy to Vercel

1. Import this repository into Vercel as a Next.js project.
2. Create a Supabase project and run the SQL migration in `supabase/migrations/20260830000000_initial.sql`.
3. In Supabase Authentication, disable public user sign-up and create the approved user manually.
4. Add these Production, Preview, and Development environment variables in Vercel:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   PRIVATE_ALLOWED_EMAILS=owner@example.com
   ```

   `PRIVATE_ALLOWED_EMAILS` is a server-only, comma-separated allowlist. Use the same email address as the manually created Supabase account.

5. Add the deployed Vercel URL to Supabase Auth URL Configuration. Add `/auth/callback` as an allowed redirect path.
6. Deploy or redeploy. Vercel supplies HTTPS, which is required by Web MIDI and installable PWA behavior.

Training, dashboard, and settings routes fail closed when Supabase or the email allowlist is missing. Public sign-up and guest training are disabled. If authentication expires while a session is already open, its result is queued in IndexedDB and retried after the approved user signs in again.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Hardware acceptance must be performed in current Chrome Desktop with a real USB MIDI keyboard. Bluetooth MIDI is best-effort when the operating system exposes the paired device to Chrome.
