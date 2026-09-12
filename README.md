# Injaz Studio

AI workspace for presentations, websites, games, apps, and shareable 3D models. Sign in, describe what you want to create (or drop in PDFs, PowerPoints, docs, CSVs and images), and the AI generates a structured, editable artifact — decks with live charts and quizzes, self-contained websites and games, or a Blender-like 3D scene you can orbit, transform, keyframe, export, and share.

## Stack

- **Next.js 15** (App Router, TypeScript) — UI + secure server-side API routes
- **Supabase** — authentication + private storage for project documents
- **DeepSeek** — planning, generation and AI editing (server-side only)
- **three.js** — 3D viewport, transforms, materials, and glTF export
- **Tailwind CSS 4**, Recharts, dnd-kit, Zustand + Zundo (undo/redo)

## Architecture

The core design rule: **the AI never generates raw HTML for decks.** It generates a structured JSON model which is validated, repaired and rendered by a controlled component system. Web projects are self-contained files. 3D models are a `scene` JSON document (objects, materials, lights, camera, keyframes) rendered in a studio viewport.

```
prompt / files
  → kind inference (presentation / website / game / app / model)
  → DeepSeek (or a local studio fallback for models)
  → validation & repair layer
  → editor / player / share link
```

- Every project has a stable ID. Presentations, sites, games, apps, and models all persist in the same private Supabase Storage bucket (`presentations/{userId}/{id}.json`) and use the same publish, share, and collaborator flow.
- Model scenes live on `presentation.scene`. Empty DeepSeek keys still create a usable studio via a local fallback.
- API keys (`DEEPSEEK_API_KEY`, `SUPABASE_SECRET_KEY`) are only ever used in route handlers.

## Key features

- **Dashboard** — chat on the left, live canvas on the right. Pick Chat, Presentation, Website, Game, App, or Model.
- **3D studio** — orbit viewport, grab / rotate / scale (G / R / S), add primitives, lights and cameras, outliner, materials, timeline keyframes, shading modes, glTF export, and a public View / Share link like any other project.
- **Staged generation** — Analysing → Planning → Designing → Finalising, streamed over SSE.
- **Editor** — slide editor for decks, code/preview for web artifacts, Blender-like studio for models. Autosave plus Share and publish.
- **Modes** — every project is also a standalone URL at `/presentations/<id>` and a shareable `/p/<id>` when published.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server-side only)
   - `DEEPSEEK_API_KEY` (server-side only)
3. Create the storage buckets (one time): `npm run setup`
4. In Supabase → Authentication, enable Google and add your local URL (e.g. `http://localhost:3000/**`) to the redirect allowlist.
5. Run: `npm run dev`

Local Cloud Agent / VM setup: `bash scripts/dev-env-up.sh` then `npm run dev`. Email/password sign-up works against the local stack without Google OAuth. Models, decks, and web projects can be created without a DeepSeek key (models use the local studio fallback).

## Production

Vercel (and any host) deploys from `main`. Set these environment variables on the project **before** the first production request, or AI and saves will fail:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
- `DEEPSEEK_API_KEY` — required for chat, generation, and follow-up edits
- `MANUS_API_KEY` — optional; websites/games/apps prefer Manus and fall back to DeepSeek

A `GET /api/health` endpoint reports `{ ok, ai, storage }` (booleans only) so you can confirm secrets are present without logging in. Container deploys use the `Dockerfile` (standalone output). Vercel builds must **not** set `output: "standalone"` — `next.config.mjs` already skips it when `VERCEL=1`.

## Tests

- `npm run test:validation` — malformed/truncated AI-response handling
- `npm run test:generate` — live DeepSeek pipeline (plan → slides → validation)
- `npx tsx scripts/test-api.ts` — end-to-end API test against a running dev server
- `npx tsx scripts/test-sse.ts` — end-to-end streamed generation test
