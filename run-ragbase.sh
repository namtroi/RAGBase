#!/bin/bash
set -e

echo "🧠 Starting RAGBase..."

# Copy .env.example if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env from .env.example — please fill in your secrets and re-run."
  exit 1
fi

docker compose -f docker-compose.prod.yml up --build
