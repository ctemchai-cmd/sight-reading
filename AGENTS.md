# Sight Reading Trainer — agent guide

Single source of truth for every coding agent on this repo. Codex reads this file
natively; Claude Code reads it through the one-line `@AGENTS.md` import in
`CLAUDE.md`. Put project rules **here**, never in `CLAUDE.md`.

A web app that trains piano sight-reading reflexes: notation → recognition →
physical response → accuracy → speed. Treble and bass clefs, major key
signatures, private single-user deployment on Vercel.

`docs/project_info.txt` is the product specification. Its
"Current V1 Implementation Decisions" section overrides anything later in that
file. When a decision changes, update that section in the same commit as the
code — it is how the next agent (and the next vendor) stays in sync.

## Working with two agents

Both Codex and Claude Code are used on this repo, one at a time.

- Commit a clean tree before switching tools. The commit log is the handoff.
- Never run both agents against the same working tree. For parallel work use
  `git worktree` on separate branches.
- Match the surrounding code rather than a house style: this codebase is
  deliberately dense and comment-light, and a diff should not be identifiable
  by which vendor wrote it.

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS 4 ·
VexFlow 5 · Tone.js · Web MIDI · Supabase (`@supabase/ssr`) · Vercel.

Do not add Redux, Zustand, Firebase, a separate backend, or an animation
framework. Reach for a new dependency only when the alternative is materially
worse, and say why in the commit message.

## Layering

Dependencies point downward only.

| Layer | Path | Rule |
| --- | --- | --- |
| Types | `src/types/` | Pure domain shapes. `NotatedPitch` (written spelling) stays separate from `expectedMidi` (sounding pitch) — the split is what makes bass clef and enharmonics possible later. |
| Core | `src/core/` | Pure TypeScript. **No React, no DOM, no browser globals.** Unit-tested. |
| Adapters | `src/hooks/`, `src/core/audio/` | Bridge browser APIs to core. MIDI, computer keyboard, Tone.js. |
| UI | `src/components/`, `src/app/` | Rendering and orchestration. Holds no music theory. |
| Persistence | `src/lib/`, `src/core/persistence/` | Supabase and the IndexedDB retry queue. |

Every input source — touch, computer keyboard, MIDI — normalizes to a
`NoteInputEvent` and enters scoring through `applyInputToTrial`. Add input
devices at that boundary; never let a device type reach the trainers.

## Measurement contract

These definitions are load-bearing; changing one invalidates stored history.

- **Accuracy** is first-attempt accuracy: first-try-correct trials ÷ completed trials.
- **Mistakes** is the total count of incorrect note-on inputs.
- **Correct response time** runs from the moment the rendered target is *armed*
  to the first correct input. Wrong inputs never restart the timer.
- A **trial** is one displayed target and may hold several attempts.

Arming happens after VexFlow has painted, via `requestAnimationFrame` →
`onReady` → `markTargetReady`. Keep it there. Arming on `setState` instead
would silently fold layout time into every measurement.

## Conventions

- Named exports everywhere; default exports only where Next.js requires them
  (pages, layouts, route handlers, `manifest.ts`).
- Import through the `@/` alias, not relative parent paths.
- Props interfaces are named `ComponentNameProps`.
- Tests sit beside their subject as `*.test.ts(x)` and cover core logic,
  not markup.
- Comments explain a non-obvious *why*. The codebase has very few; do not
  narrate code that already reads clearly.
- Mark deliberately floating promises with `void`, and keep the hot training
  loop on refs so a re-render cannot drop an input.
- Dark theme is the baseline. Light mode is carried by the overrides at the
  bottom of `globals.css`; check both when touching training surfaces.
- Notation renders on a paper-white surface in every theme so musical ink
  stays dark.

## Verification

Run all five before calling work done. `test:e2e` needs Chromium installed
(`npx playwright install chromium`).

```bash
npm test          # vitest
npm run lint      # eslint
npm run typecheck # tsc --noEmit
npm run build     # next build
npm run test:e2e  # playwright, desktop + 360px portrait + 800x360 landscape
```

Layout work must additionally hold at a 360 px viewport and at 800 × 360
landscape with no document-level horizontal overflow — the e2e suite asserts
this, so do not weaken those assertions to make a change pass.

## Traps

- **`src/proxy.ts` is the middleware.** Next.js 16 renamed it. It gates
  `/train`, `/dashboard`, and `/settings`, and fails closed when Supabase
  config or a valid non-anonymous session is missing.
- **This file's `nextjs-agent-rules` block is machine-managed.** `next dev`
  rewrites the region between its markers and preserves everything outside,
  so keep project content out of that block and commit the block when it
  changes rather than reverting it.
- **No public sign-up exists.** Accounts are created by hand in the Supabase
  dashboard. Do not add a `/signup` route; an e2e test asserts it 404s.
- **`save_training_session` is idempotent** on a client-generated session id,
  which is what makes the pending-queue retry safe. Preserve that if you touch
  the RPC or the migration.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  are configured. There is no service-role key in this app.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
