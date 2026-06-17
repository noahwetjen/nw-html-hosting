#!/usr/bin/env bash
set -euo pipefail

APP_PORT="${CONDUCTOR_PORT:-3000}"
POSTGRES_PORT="${POSTGRES_PORT:-$((APP_PORT + 1))}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-shareable_html_${APP_PORT}}"

export POSTGRES_PORT
export COMPOSE_PROJECT_NAME

docker compose up -d postgres

for attempt in {1..30}; do
  if docker compose exec -T postgres pg_isready -U postgres -d shareable_agent_html >/dev/null 2>&1; then
    break
  fi

  if [ "${attempt}" -eq 30 ]; then
    echo "Postgres did not become ready in time." >&2
    docker compose logs postgres >&2
    exit 1
  fi

  sleep 1
done

export PORT="${APP_PORT}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:${APP_PORT}}"
export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/shareable_agent_html}"
export HTML_HOSTING_API_KEY="${HTML_HOSTING_API_KEY:-local-dev-key}"

npm run dev
