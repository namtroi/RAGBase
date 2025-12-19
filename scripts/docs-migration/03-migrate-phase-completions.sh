#!/bin/bash
# Migrates PHASE_XX_COMPLETE.md files

set -e

echo "=== Migrating Phase Completion Documents ==="

DEST="plans/2025-12-13-phase1-tdd-implementation/completion"

# Phase completion files
for phase in {00..06}; do
  src="PHASE_${phase}_COMPLETE.md"
  dest="$DEST/phase-${phase}-complete.md"

  if [[ -f "$src" ]]; then
    echo "Moving: $src → $dest"
    git mv "$src" "$dest"
  else
    echo "⚠️  Skipping missing: $src"
  fi
done

echo "✅ Phase completions migrated"
