# Sight Reading Trainer

A Chrome Desktop-first piano sight-reading trainer built with Next.js, VexFlow, Tone.js, Web MIDI, and Supabase.

## Deploy to Vercel

1. Import this repository into Vercel as a Next.js project.
2. Create a Supabase project and run the SQL migration in `supabase/migrations/20260830000000_initial.sql`.
3. Add these Production, Preview, and Development environment variables in Vercel:

   ```text
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   ```

4. Add the deployed Vercel URL to Supabase Auth URL Configuration. Add `/auth/callback` as an allowed redirect path.
5. Deploy. Vercel supplies HTTPS, which is required by Web MIDI and installable PWA behavior.

The application remains usable in guest mode when Supabase variables are absent. Signed-in cloud history requires the migration and environment variables.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Hardware acceptance must be performed in current Chrome Desktop with a real USB MIDI keyboard. Bluetooth MIDI is best-effort when the operating system exposes the paired device to Chrome.
