#!/bin/bash
# Migrates and renames core documentation

set -e

echo "=== Migrating Core Documentation ==="

# Rename and move core docs
declare -A CORE_DOCS=(
  ["docs/ARCHITECTURE.md"]="docs/core/system-architecture.md"
  ["docs/CONTRACT.md"]="docs/core/api-contracts.md"
  ["docs/OVERVIEW.md"]="docs/core/project-overview-pdr.md"
  ["docs/ROADMAP.md"]="docs/core/project-roadmap.md"
  ["docs/TEST_STRATEGY.md"]="docs/core/testing-strategy.md"
  ["docs/code-standards.md"]="docs/core/code-standards.md"
  ["docs/codebase-summary.md"]="docs/core/codebase-summary.md"
)

for src in "${!CORE_DOCS[@]}"; do
  dest="${CORE_DOCS[$src]}"
  if [[ -f "$src" ]]; then
    echo "Moving: $src → $dest"
    git mv "$src" "$dest"
  else
    echo "⚠️  Skipping missing: $src"
  fi
done

echo "✅ Core documentation migrated"
