#!/bin/bash
# Validates current state before migration

set -e

echo "=== Documentation Migration Pre-Validation ==="

# Check git status is clean (allow only untracked files)
if git diff --quiet && git diff --cached --quiet; then
  echo "✅ Git working directory clean"
else
  echo "❌ Git working directory not clean. Commit or stash changes first."
  exit 1
fi

# Verify all source files exist
SOURCE_FILES=(
  "PHASE_00_COMPLETE.md"
  "PHASE_01_COMPLETE.md"
  "PHASE_02_COMPLETE.md"
  "PHASE_03_COMPLETE.md"
  "PHASE_04_COMPLETE.md"
  "PHASE_05_COMPLETE.md"
  "PHASE_06_COMPLETE.md"
  "CODE_REVIEW_SUMMARY.md"
  "FIX_RECOMMENDATIONS.md"
  "REMAINING-WORK-PLAN.md"
  "TYPESCRIPT_FIX.md"
  "docs/ARCHITECTURE.md"
  "docs/CONTRACT.md"
  "docs/OVERVIEW.md"
  "docs/ROADMAP.md"
  "docs/TEST_STRATEGY.md"
  "docs/FAST_LANE_PROCESSING.md"
  "docs/FAST_LANE_QUICK_REFERENCE.md"
  "docs/FASTEMBED_MIGRATION.md"
  "docs/EMBEDDING_TEST_ISSUE.md"
  "docs/HELPER_FILES_SOLUTION.md"
  "docs/TYPESCRIPT_PATH_FIX.md"
)

MISSING=0
for file in "${SOURCE_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "❌ Missing: $file"
    MISSING=$((MISSING + 1))
  fi
done

if [[ $MISSING -gt 0 ]]; then
  echo "❌ $MISSING files missing. Aborting."
  exit 1
fi

echo "✅ All source files exist ($((${#SOURCE_FILES[@]} - MISSING)) files)"

# Verify target directories don't have conflicts
TARGET_DIRS=(
  "docs/core"
  "docs/guides"
  "docs/features"
  "docs/migrations"
  "docs/historical"
  "docs/templates"
  "plans/2025-12-13-phase1-tdd-implementation/completion"
  "plans/reports/archive"
)

for dir in "${TARGET_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo "⚠️  Directory already exists: $dir"
  fi
done

echo "✅ Pre-validation complete"
