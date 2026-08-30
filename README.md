# Sight Reading Trainer

A Chrome Desktop-first piano sight-reading trainer built with Next.js, VexFlow, Tone.js, Web MIDI, and Supabase.

## Deploy to Vercel

1. Import this repository into Vercel as a Next.js project.
2. Create a Supabase project and run every file in `supabase/migrations/` in filename order, in the Supabase SQL editor. They are plain SQL and are applied by hand; there is no migration runner wired up.
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

## Piano samples

`public/audio/piano/` holds the note recordings the trainer plays. The audio
engine loads one sample every minor third and lets Tone repitch between them,
which keeps the decoded buffers small enough for a phone, and it preloads them
when a trainer mounts so the first key press is not the thing that waits.

If the folder is missing the app falls back to a synth voice rather than
falling silent. Replacing the set means dropping in files named for their pitch
with flats spelled `b` — `Eb4.mp3` — covering at least every minor third from
C2 to C7. Only use a set whose licence permits this project's use.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Hardware acceptance must be performed in current Chrome Desktop with a real USB MIDI keyboard. Bluetooth MIDI is best-effort when the operating system exposes the paired device to Chrome.
