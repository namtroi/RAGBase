#!/bin/bash
set -e

echo "🧠 Starting RAGBase..."

# Copy .env.example if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env from .env.example — please fill in your secrets and re-run."
  exit 1
fi

# Fix permissions on existing shared-uploads volume (owned by root from prior runs)
echo "🔧 Ensuring correct permissions on shared uploads volume..."
docker compose run --rm --no-deps --entrypoint "sh" -u root backend -c "mkdir -p /tmp/uploads && chown -R 1000:1000 /tmp/uploads"

docker compose up --build
