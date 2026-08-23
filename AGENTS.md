# AGENTS.md

## Cursor Cloud specific instructions

`present@karm` is a single **Next.js 15** app (App Router, TypeScript). Standard commands live in `package.json` (`dev`, `build`, `start`, `setup`, `test:validation`) and setup steps are in `README.md`. The app depends on two external services: **Supabase** (auth + storage) and **DeepSeek** (AI generation/editing). There is no local database of its own — persistence is Supabase Storage buckets (`presentations`, `uploads`). There is no ESLint config or `lint` script; type-safety is enforced by `next build` (it runs "Linting and checking validity of types").

### Local Supabase (used instead of a cloud project)
Auth + storage are backed by a **local Supabase stack** (Docker), so no cloud credentials are needed for the non-AI flow. The Docker engine, Supabase CLI, and a Supabase project at `~/supabase-local` are preinstalled in this environment.

**IMPORTANT:** this VM has **no systemd** (PID 1 is `tini`), so the Docker daemon does **not** auto-start after a reboot / fresh session — and when Docker is down, the whole Supabase stack (including **Supabase Studio** at `:54323`) is down with it. Bring everything up each session with the idempotent helper script (the `dev` server, Docker daemon, and Supabase are intentionally NOT started by the update script):

```bash
bash scripts/dev-env-up.sh   # starts dockerd + Supabase, writes .env.local, ensures buckets
npm run dev                  # http://localhost:3000  (Studio: http://127.0.0.1:54323)
```

`scripts/dev-env-up.sh` is safe to re-run: it starts `dockerd` only if `docker info` fails, starts Supabase only if not already running (data persists across restarts), regenerates `.env.local` from `supabase status`, and re-creates the storage buckets. If Studio "doesn't work", the fix is almost always that Docker/Supabase aren't running — just run this script.

- Docker here uses the **fuse-overlayfs** storage driver (kernel limitation); this is already set in `/etc/docker/daemon.json`. Do not switch it to `overlay2`.
- `.env.local` (gitignored) is written by the script. It preserves an existing `DEEPSEEK_API_KEY` if one is set.
- The app supports **email/password sign-up** in addition to Google OAuth. Local Supabase has email confirmations disabled, so sign-up returns a session immediately — this is the easiest way to get past auth without configuring Google OAuth. Google OAuth does **not** work against the local stack without extra provider config.
- Presentations can be created **blank or from a template** (dashboard "New presentation" / Templates) with no DeepSeek key — this exercises auth, the API routes, storage persistence, and the editor end-to-end.

### DeepSeek (AI features)
`DEEPSEEK_API_KEY` in `.env.local` is empty by default, so the AI "generate a presentation" and "AI edit" flows will error. Set a real key there to test those paths. Everything else (auth, create/edit/save/publish, present mode) works without it.

### Inspecting stored data
Presentation JSON and users live in the local stack; inspect with the DB container, e.g. `docker exec supabase_db_supabase-local psql -U postgres -d postgres -c "select name from storage.objects where bucket_id='presentations';"`. Supabase Studio is at http://127.0.0.1:54323.
