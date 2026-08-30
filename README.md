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
   ```

5. Add the deployed Vercel URL to Supabase Auth URL Configuration. Add `/auth/callback` as an allowed redirect path.
6. Deploy or redeploy. Vercel supplies HTTPS, which is required by Web MIDI and installable PWA behavior.

Training, dashboard, and settings routes fail closed when Supabase is missing or there is no valid non-anonymous Supabase session. The application has no public sign-up route and guest training is disabled, so access is managed by creating or deleting users in the Supabase dashboard. If authentication expires while a session is already open, its result is queued in IndexedDB and retried after the user signs in again.

### Refresh an existing PWA installation

The manifest keeps the previous `/train` app identity but now launches at `/` with scope `/`. After deploying this update, close the installed app and restart Chrome so it refreshes the manifest. Check `about://web-app-internals/` for `manifest_id` and `start_url`. If the operating-system icon still does not launch, remove the old installed app from Chrome and install it again from the production URL; an old OS shortcut can remain stale even when Chrome's “Open in app” action works.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Hardware acceptance must be performed in current Chrome Desktop with a real USB MIDI keyboard. Bluetooth MIDI is best-effort when the operating system exposes the paired device to Chrome.
