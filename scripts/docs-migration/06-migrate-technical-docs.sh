#!/bin/bash
# Migrates migrations and historical notes

set -e

echo "=== Migrating Technical Documentation ==="

# Migration docs
declare -A MIGRATION_DOCS=(
  ["docs/FASTEMBED_MIGRATION.md"]="docs/migrations/fastembed-migration.md"
)

for src in "${!MIGRATION_DOCS[@]}"; do
  dest="${MIGRATION_DOCS[$src]}"
  if [[ -f "$src" ]]; then
    echo "Moving: $src → $dest"
    git mv "$src" "$dest"
  else
    echo "⚠️  Skipping missing: $src"
  fi
done

# Historical notes
declare -A HISTORICAL_DOCS=(
  ["docs/EMBEDDING_TEST_ISSUE.md"]="docs/historical/embedding-test-issue.md"
  ["docs/HELPER_FILES_SOLUTION.md"]="docs/historical/helper-files-solution.md"
  ["docs/TYPESCRIPT_PATH_FIX.md"]="docs/historical/typescript-path-fix.md"
  ["TYPESCRIPT_FIX.md"]="docs/historical/typescript-fix.md"
)

for src in "${!HISTORICAL_DOCS[@]}"; do
  dest="${HISTORICAL_DOCS[$src]}"
  if [[ -f "$src" ]]; then
    echo "Moving: $src → $dest"
    git mv "$src" "$dest"
  else
    echo "⚠️  Skipping missing: $src"
  fi
done

echo "✅ Technical documentation migrated"
