# Sight Reading Trainer

A Chrome Desktop-first piano sight-reading trainer built with Next.js, VexFlow, Tone.js, Web MIDI, and Supabase. Training runs in a major key of your choosing, or a random one each session, with the sharps and flats read from the key signature rather than written on the notes.

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

### Installing on Android

Android turns the manifest into a real package — a WebAPK minted by Google at
install time — rather than a shortcut. Manifest fields become activity
attributes inside that package, so a manifest that is harmless elsewhere can
change how the app launches here: declaring `orientation: landscape` once left
the app unable to launch from its home screen icon at all, though it still
opened from the app drawer and from Chrome. Two further consequences follow.

Manifest changes do not appear immediately: Chrome checks for an update about
once a day, has the package re-minted, and applies it on a later launch. Web
content still updates on every deploy; only the identity, icon, and orientation
are baked into the package.

An uninstall can leave a dead launcher icon behind that points at a package
generation that no longer exists — tapping it does nothing while the app still
opens from the app drawer. Remove that icon and place a fresh one from the
drawer. `chrome://webapk-internals/` on the device lists the installed package,
its manifest id, and its update status.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Hardware acceptance must be performed in current Chrome Desktop with a real USB MIDI keyboard. Bluetooth MIDI is best-effort when the operating system exposes the paired device to Chrome.
