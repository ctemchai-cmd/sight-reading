# Sight Reading Trainer

A Chrome Desktop-first piano sight-reading trainer built with Next.js, VexFlow, Tone.js, and Web MIDI. Training runs on either clef and in a major key of your choosing, or a random one each session, with the sharps and flats read from the key signature rather than written on the notes.

## Deploy to Vercel

1. Import this repository into Vercel as a Next.js project.
2. Add these Production, Preview, and Development environment variables in Vercel:

   ```text
   APP_PASSWORD     the one password that opens the trainer
   GEMINI_API_KEY   optional; the coach answers 503 without it
   ```

3. Deploy or redeploy. Vercel supplies HTTPS, which is required by Web MIDI and installable PWA behavior.

For local development put the same variables in `.env.local`.

Training, Free Play, coach, and settings routes fail closed when `APP_PASSWORD` is missing or the browser has no valid session cookie. There are no accounts and no public sign-up: logging in with the password sets an HTTP-only cookie holding a digest of it, and changing `APP_PASSWORD` signs out every device. Nothing about practice is stored — each session's result is shown when it ends and then discarded; settings live in the browser's `localStorage`.

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
