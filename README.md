# Studio

AI workspace for presentations, websites, games, and apps. Sign in with Google, describe what you want to create (or drop in PDFs, PowerPoints, docs, CSVs and images), and the AI generates a structured, editable, fully interactive artifact — presentations with live charts, timelines, maps, tabs and quizzes, or self-contained websites and games that publish to a real URL (including custom domains).

## Stack

- **Next.js 15** (App Router, TypeScript) — UI + secure server-side API routes
- **Supabase** — Google authentication + private storage for presentation documents
- **DeepSeek** — presentation planning, slide generation and AI editing (server-side only)
- **Tailwind CSS 4**, Recharts, dnd-kit, Zustand + Zundo (undo/redo)

## Architecture

The core design rule: **the AI never generates HTML.** It generates a structured presentation model (JSON) which is validated, repaired and rendered by a controlled component system.

```
prompt / files
  → content extraction (PDF, DOCX, PPTX, CSV, text, images)
  → DeepSeek plans the presentation      (title, theme, slide-by-slide brief)
  → DeepSeek designs slides in batches   (structured JSON, parallel calls)
  → validation & repair layer            (zod schemas, truncation repair, URL sanitising)
  → controlled renderer                  (React components, no arbitrary JS execution)
  → editable interactive presentation
```

- Every slide and element has a stable ID, so AI edits modify individual elements through validated operations (`updateElement`, `replaceSlide`, `addSlide`, ...) instead of regenerating the deck.
- Presentations are isolated JSON documents in a **private** Supabase Storage bucket (`presentations/{userId}/{id}.json`); ownership is enforced server-side on every request. Uploaded images go to a public `uploads` bucket.
- API keys (`DEEPSEEK_API_KEY`, `SUPABASE_SECRET_KEY`) are only ever used in route handlers.

## Key features

- **Dashboard** — big “What do you want to present?” prompt, polished drag-and-drop upload with progress/previews/errors, recent presentation cards with live slide thumbnails, search/sort, templates, settings.
- **Staged generation experience** — Analysing → Planning → Designing (with slide progress) → Adding interactive elements → Finalising, streamed over SSE.
- **Editor** — three panels: slide navigator (drag to reorder), live canvas (select, move, resize, inline text editing, drop images/components), inspector (position, style, animation, per-component data editors). Full undo/redo and debounced autosave with Saving/Saved/Unable-to-save states.
- **AI editing** — “Ask Studio to change anything...” chat that understands the selected slide/element and applies validated operations to the model.
- **Modes** — Edit, Preview, and fullscreen Present with keyboard navigation and transitions. Every presentation is also a standalone site at `/presentations/<id>`.

## Setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server-side only)
   - `DEEPSEEK_API_KEY` (server-side only)
3. Create the storage buckets (one time): `npm run setup`
4. In Supabase → Authentication, enable Google and add your local URL (e.g. `http://localhost:3000/**`) to the redirect allowlist.
5. Run: `npm run dev`

## Tests

- `npm run test:validation` — malformed/truncated AI-response handling
- `npm run test:generate` — live DeepSeek pipeline (plan → slides → validation)
- `npx tsx scripts/test-api.ts` — end-to-end API test against a running dev server (auth guards, CRUD, autosave, ownership isolation, AI edit)
- `npx tsx scripts/test-sse.ts` — end-to-end streamed generation test
