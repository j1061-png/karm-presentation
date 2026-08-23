#!/usr/bin/env bash
#
# Bring up the local backing services for present@karm and make the app runnable.
#
# This VM has no systemd (PID 1 is tini), so the Docker daemon does NOT auto-start
# after a reboot / fresh session — which takes the whole local Supabase stack
# (including Supabase Studio) down with it. This script starts everything in the
# right order and is safe to re-run (idempotent).
#
# Usage:  bash scripts/dev-env-up.sh
# Then:   npm run dev        # http://localhost:3000
#
set -euo pipefail

SUPABASE_PROJECT_DIR="${SUPABASE_PROJECT_DIR:-$HOME/supabase-local}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env.local"

log() { printf '\033[36m[dev-env]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[dev-env] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Docker daemon (no systemd here, so start dockerd directly).
# ---------------------------------------------------------------------------
if ! sudo docker info >/dev/null 2>&1; then
  log "Docker daemon not running — starting dockerd..."
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
  sudo docker info >/dev/null 2>&1 || die "dockerd failed to start (see /tmp/dockerd.log)"
fi
# Let the non-root user reach the socket without sudo (needed by the Supabase CLI).
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
log "Docker is up (v$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?'))."

# ---------------------------------------------------------------------------
# 2. Local Supabase stack (auth + storage + Studio).
# ---------------------------------------------------------------------------
command -v supabase >/dev/null 2>&1 || die "supabase CLI not found on PATH."

if [ ! -f "$SUPABASE_PROJECT_DIR/supabase/config.toml" ]; then
  log "Initialising Supabase project at $SUPABASE_PROJECT_DIR..."
  mkdir -p "$SUPABASE_PROJECT_DIR"
  ( cd "$SUPABASE_PROJECT_DIR" && supabase init --force >/dev/null )
fi

if supabase status --workdir "$SUPABASE_PROJECT_DIR" >/dev/null 2>&1; then
  log "Supabase already running."
else
  log "Starting Supabase stack (first run pulls images and can take a minute)..."
  supabase start --workdir "$SUPABASE_PROJECT_DIR"
fi

# ---------------------------------------------------------------------------
# 3. Write .env.local for the Next.js app from the live Supabase status.
#    Any existing DEEPSEEK_API_KEY is preserved.
# ---------------------------------------------------------------------------
status_env="$(supabase status --workdir "$SUPABASE_PROJECT_DIR" -o env 2>/dev/null)"
get() { printf '%s\n' "$status_env" | sed -n "s/^$1=\"\(.*\)\"$/\1/p" | head -1; }

API_URL="$(get API_URL)"
PUBLISHABLE_KEY="$(get PUBLISHABLE_KEY)"
SECRET_KEY="$(get SECRET_KEY)"
[ -n "$API_URL" ] && [ -n "$PUBLISHABLE_KEY" ] && [ -n "$SECRET_KEY" ] \
  || die "Could not read Supabase keys from 'supabase status -o env'."

# Preserve a previously-set DeepSeek key (empty by default).
DEEPSEEK_API_KEY="${DEEPSEEK_API_KEY:-}"
if [ -z "$DEEPSEEK_API_KEY" ] && [ -f "$ENV_FILE" ]; then
  DEEPSEEK_API_KEY="$(sed -n 's/^DEEPSEEK_API_KEY=\(.*\)$/\1/p' "$ENV_FILE" | head -1)"
fi

cat > "$ENV_FILE" <<EOF
# Local development — points at the local Supabase stack (scripts/dev-env-up.sh).
# Auto-generated; re-run the script to refresh.
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY

# Server-side only — never exposed to the browser.
SUPABASE_SECRET_KEY=$SECRET_KEY

# DeepSeek — set to a real key to enable AI generation/editing.
DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY
EOF
log "Wrote $ENV_FILE"

# ---------------------------------------------------------------------------
# 4. Ensure the storage buckets exist (idempotent).
# ---------------------------------------------------------------------------
log "Ensuring storage buckets exist..."
( cd "$REPO_DIR" && npm run --silent setup )

STUDIO_URL="$(get STUDIO_URL)"
log "Done. Supabase Studio: ${STUDIO_URL:-http://127.0.0.1:54323}"
log "Start the app with:  npm run dev   (http://localhost:3000)"
