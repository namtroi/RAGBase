#!/bin/bash
# Migrates remaining planning documents

set -e

echo "=== Migrating Planning Documents ==="

SRC="REMAINING-WORK-PLAN.md"
DEST="plans/2025-12-13-phase1-tdd-implementation/remaining-work-plan.md"

if [[ -f "$SRC" ]]; then
  echo "Moving: $SRC → $DEST"
  git mv "$SRC" "$DEST"
fi

echo "✅ Planning documents migrated"
