# Phase 03: Create Migration Scripts

**Priority:** High
**Status:** Ready to implement
**Estimated Complexity:** Medium

## Overview

Create automated scripts to safely migrate documentation files to their new locations while preserving git history.

## Migration Strategy

**Approach:** Use `git mv` to preserve file history, not `mv`

**Benefits:**
- Maintains git blame/log continuity
- Preserves file history across renames
- Allows easy rollback if needed

## Migration Scripts

### Script 1: Pre-Migration Validation

**File:** `scripts/docs-migration/01-validate-structure.sh`

```bash
#!/bin/bash
# Validates current state before migration

set -e

echo "=== Documentation Migration Pre-Validation ==="

# Check git status is clean
if [[ -n $(git status --porcelain) ]]; then
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

echo "✅ All source files exist"

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
```

### Script 2: Create Directory Structure

**File:** `scripts/docs-migration/02-create-directories.sh`

```bash
#!/bin/bash
# Creates new directory structure

set -e

echo "=== Creating Documentation Directory Structure ==="

# Create all target directories
mkdir -p docs/core
mkdir -p docs/guides
mkdir -p docs/features
mkdir -p docs/migrations
mkdir -p docs/historical
mkdir -p docs/templates
mkdir -p plans/2025-12-13-phase1-tdd-implementation/completion
mkdir -p plans/reports/archive

echo "✅ Directories created"

# Verify creation
for dir in docs/{core,guides,features,migrations,historical,templates}; do
  if [[ -d "$dir" ]]; then
    echo "✅ $dir"
  else
    echo "❌ Failed to create $dir"
    exit 1
  fi
done
```

### Script 3: Migrate Phase Completion Docs

**File:** `scripts/docs-migration/03-migrate-phase-completions.sh`

```bash
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
```

### Script 4: Migrate Core Documentation

**File:** `scripts/docs-migration/04-migrate-core-docs.sh`

```bash
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
```

### Script 5: Migrate Feature Documentation

**File:** `scripts/docs-migration/05-migrate-feature-docs.sh`

```bash
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
```

### Script 6: Migrate Technical Documentation

**File:** `scripts/docs-migration/06-migrate-technical-docs.sh`

```bash
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
```

### Script 7: Archive Old Reports

**File:** `scripts/docs-migration/07-archive-old-reports.sh`

```bash
#!/bin/bash
# Archives old code review reports

set -e

echo "=== Archiving Old Reports ==="

DEST="plans/reports/archive"

# Move old reports from root
declare -a ROOT_REPORTS=(
  "CODE_REVIEW_SUMMARY.md"
  "FIX_RECOMMENDATIONS.md"
  "REVIEW_COMPLETE.txt"
)

for file in "${ROOT_REPORTS[@]}"; do
  if [[ -f "$file" ]]; then
    echo "Archiving: $file → $DEST/$file"
    git mv "$file" "$DEST/$file"
  fi
done

# Move 2024 reports from plans/reports/ to archive
cd plans/reports
for file in 2024-*.md; do
  if [[ -f "$file" ]]; then
    echo "Archiving: plans/reports/$file → archive/$file"
    git mv "$file" "archive/$file"
  fi
done
cd ../..

echo "✅ Old reports archived"
```

### Script 8: Move Remaining Work Plan

**File:** `scripts/docs-migration/08-migrate-plans.sh`

```bash
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
```

### Script 9: Delete Generated Artifacts

**File:** `scripts/docs-migration/09-cleanup-artifacts.sh`

```bash
#!/bin/bash
# Removes generated artifacts that can be recreated

set -e

echo "=== Cleaning Up Generated Artifacts ==="

ARTIFACTS=(
  "repomix-output.xml"
)

for file in "${ARTIFACTS[@]}"; do
  if [[ -f "$file" ]]; then
    echo "Removing: $file"
    rm -f "$file"
    git add "$file" 2>/dev/null || true
  fi
done

echo "✅ Artifacts cleaned up"
```

### Master Migration Script

**File:** `scripts/docs-migration/run-migration.sh`

```bash
#!/bin/bash
# Master script to run all migration steps

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   SchemaForge Documentation Migration        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Run all steps in order
for script in "$SCRIPT_DIR"/{01..09}-*.sh; do
  if [[ -f "$script" ]]; then
    echo ""
    echo "▶ Running: $(basename "$script")"
    bash "$script"
  fi
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Migration Complete!                        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Run Phase 05: Update References & Links"
echo "3. Commit changes: git commit -m 'docs: Refactor documentation structure'"
```

## Rollback Strategy

### Rollback Script

**File:** `scripts/docs-migration/rollback.sh`

```bash
#!/bin/bash
# Rollback migration if something goes wrong

set -e

echo "⚠️  WARNING: This will undo all documentation migration changes"
read -p "Are you sure? (yes/NO): " confirm

if [[ "$confirm" != "yes" ]]; then
  echo "Rollback cancelled"
  exit 0
fi

echo "Rolling back changes..."

# Reset to HEAD before migration
git reset --hard HEAD~1

echo "✅ Rollback complete"
```

## Implementation Steps

1. Create `scripts/docs-migration/` directory
2. Write all 9 migration scripts + master script
3. Make scripts executable: `chmod +x scripts/docs-migration/*.sh`
4. Test in dry-run mode (add `--dry-run` flag to git mv)
5. Review generated changes
6. Execute migration

## Testing Strategy

### Dry Run
Add `echo` before all `git mv` commands for testing:
```bash
# Testing mode
echo "git mv $src $dest"

# Production mode
git mv "$src" "$dest"
```

### Validation Checks
After each step:
- Verify source file removed
- Verify destination file exists
- Check git status shows rename, not delete+add
- Verify no untracked files

## Success Criteria

- [ ] All scripts created and executable
- [ ] Dry-run tested successfully
- [ ] No git history lost
- [ ] All files moved to correct locations
- [ ] Zero untracked files in root
- [ ] Rollback script tested

## Next Phase

**Phase 04:** Execute Migration (run the scripts)
