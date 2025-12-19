#!/bin/bash
# Migrates feature-specific documentation

set -e

echo "=== Migrating Feature Documentation ==="

declare -A FEATURE_DOCS=(
  ["docs/FAST_LANE_PROCESSING.md"]="docs/features/fast-lane-processing.md"
  ["docs/FAST_LANE_QUICK_REFERENCE.md"]="docs/features/fast-lane-quick-reference.md"
)

for src in "${!FEATURE_DOCS[@]}"; do
  dest="${FEATURE_DOCS[$src]}"
  if [[ -f "$src" ]]; then
    echo "Moving: $src → $dest"
    git mv "$src" "$dest"
  else
    echo "⚠️  Skipping missing: $src"
  fi
done

echo "✅ Feature documentation migrated"
