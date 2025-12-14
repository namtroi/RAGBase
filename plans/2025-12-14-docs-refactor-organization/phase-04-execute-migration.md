# Phase 04: Execute Migration

**Priority:** High
**Status:** Ready after Phase 03
**Estimated Complexity:** Low (scripts automate)

## Overview

Execute the migration scripts created in Phase 03 to move all documentation files to their new locations.

## Pre-Execution Checklist

### Git Safety
- [ ] Working directory is clean (`git status`)
- [ ] All changes committed
- [ ] Current branch backed up
- [ ] Team notified (if collaborative project)

### Backup Strategy
```bash
# Create backup branch
git checkout -b backup/pre-docs-migration

# Return to working branch
git checkout refactor/docs/afterphase06

# If rollback needed later
git reset --hard backup/pre-docs-migration
```

### Environment Check
- [ ] Running on correct branch
- [ ] All source files present
- [ ] Scripts are executable
- [ ] No merge conflicts

## Execution Plan

### Step 1: Pre-Migration Validation
```bash
cd D:/14-osp/SchemaForge
bash scripts/docs-migration/01-validate-structure.sh
```

**Expected Output:**
```
=== Documentation Migration Pre-Validation ===
✅ All source files exist
✅ Pre-validation complete
```

**If fails:** Review missing files, fix issues, re-run

### Step 2: Create Directory Structure
```bash
bash scripts/docs-migration/02-create-directories.sh
```

**Expected Output:**
```
=== Creating Documentation Directory Structure ===
✅ Directories created
✅ docs/core
✅ docs/guides
✅ docs/features
✅ docs/migrations
✅ docs/historical
✅ docs/templates
```

**Validation:**
```bash
ls -la docs/
# Should see: core/ guides/ features/ migrations/ historical/ templates/
```

### Step 3: Migrate Phase Completions
```bash
bash scripts/docs-migration/03-migrate-phase-completions.sh
```

**Expected Output:**
```
=== Migrating Phase Completion Documents ===
Moving: PHASE_00_COMPLETE.md → plans/.../completion/phase-00-complete.md
Moving: PHASE_01_COMPLETE.md → plans/.../completion/phase-01-complete.md
...
✅ Phase completions migrated
```

**Validation:**
```bash
ls -1 PHASE_*.md
# Should return: (no files found)

ls -1 plans/2025-12-13-phase1-tdd-implementation/completion/
# Should show: phase-00-complete.md through phase-06-complete.md
```

### Step 4: Migrate Core Documentation
```bash
bash scripts/docs-migration/04-migrate-core-docs.sh
```

**Expected Output:**
```
=== Migrating Core Documentation ===
Moving: docs/ARCHITECTURE.md → docs/core/system-architecture.md
Moving: docs/CONTRACT.md → docs/core/api-contracts.md
...
✅ Core documentation migrated
```

**Validation:**
```bash
ls -1 docs/core/
# Should show standardized filenames
```

### Step 5: Migrate Feature Documentation
```bash
bash scripts/docs-migration/05-migrate-feature-docs.sh
```

**Expected Output:**
```
=== Migrating Feature Documentation ===
Moving: docs/FAST_LANE_PROCESSING.md → docs/features/fast-lane-processing.md
...
✅ Feature documentation migrated
```

### Step 6: Migrate Technical Documentation
```bash
bash scripts/docs-migration/06-migrate-technical-docs.sh
```

**Expected Output:**
```
=== Migrating Technical Documentation ===
Moving: docs/FASTEMBED_MIGRATION.md → docs/migrations/fastembed-migration.md
Moving: TYPESCRIPT_FIX.md → docs/historical/typescript-fix.md
...
✅ Technical documentation migrated
```

### Step 7: Archive Old Reports
```bash
bash scripts/docs-migration/07-archive-old-reports.sh
```

**Expected Output:**
```
=== Archiving Old Reports ===
Archiving: CODE_REVIEW_SUMMARY.md → plans/reports/archive/...
...
✅ Old reports archived
```

### Step 8: Migrate Planning Documents
```bash
bash scripts/docs-migration/08-migrate-plans.sh
```

**Expected Output:**
```
=== Migrating Planning Documents ===
Moving: REMAINING-WORK-PLAN.md → plans/.../remaining-work-plan.md
✅ Planning documents migrated
```

### Step 9: Cleanup Artifacts
```bash
bash scripts/docs-migration/09-cleanup-artifacts.sh
```

**Expected Output:**
```
=== Cleaning Up Generated Artifacts ===
Removing: repomix-output.xml
✅ Artifacts cleaned up
```

## All-in-One Execution

### Run Master Script
```bash
bash scripts/docs-migration/run-migration.sh
```

**Expected Output:**
```
╔══════════════════════════════════════════════╗
║   SchemaForge Documentation Migration        ║
╚══════════════════════════════════════════════╝

▶ Running: 01-validate-structure.sh
...
▶ Running: 09-cleanup-artifacts.sh
...

╔══════════════════════════════════════════════╗
║   Migration Complete!                        ║
╚══════════════════════════════════════════════╝
```

## Post-Migration Validation

### Check Root Directory
```bash
ls -1 *.md
```

**Expected:** Only `README.md` and `CLAUDE.md`

### Check Git Status
```bash
git status
```

**Expected:**
- Renamed files shown as renames, not deletes + adds
- New directories tracked
- No untracked files

**Example:**
```
renamed:    PHASE_00_COMPLETE.md -> plans/.../completion/phase-00-complete.md
renamed:    docs/ARCHITECTURE.md -> docs/core/system-architecture.md
new file:   docs/core/
```

### Verify File Counts
```bash
# Count files in each directory
find docs/core -name "*.md" | wc -l        # Should be 7
find docs/features -name "*.md" | wc -l    # Should be 2
find docs/migrations -name "*.md" | wc -l  # Should be 1
find docs/historical -name "*.md" | wc -l  # Should be 4
find plans/2025-12-13-phase1-tdd-implementation/completion -name "*.md" | wc -l  # Should be 7
```

### Test Git History Preservation
```bash
# Pick any migrated file
git log --follow docs/core/system-architecture.md

# Should show full history from when it was ARCHITECTURE.md
```

## Rollback Procedure

### If Migration Fails Mid-Process
```bash
# Stop immediately
Ctrl+C

# Rollback
git reset --hard HEAD

# Review what went wrong
# Fix scripts
# Re-run
```

### If Migration Completes But Has Issues
```bash
# Before committing, you can still rollback
git reset --hard HEAD

# Or use backup branch
git reset --hard backup/pre-docs-migration
```

## Common Issues & Solutions

### Issue: "Directory not empty" error
**Solution:** Script already ran partially. Run cleanup first:
```bash
git reset --hard HEAD
bash scripts/docs-migration/run-migration.sh
```

### Issue: File not found
**Solution:** File already moved or doesn't exist. Update script to skip:
```bash
if [[ -f "$src" ]]; then
  git mv "$src" "$dest"
else
  echo "⚠️  Already migrated or missing: $src"
fi
```

### Issue: Git shows delete+add instead of rename
**Cause:** File modified between `git mv` operations
**Solution:** Commit intermediate state:
```bash
git add -A
git commit -m "wip: partial migration"
# Continue migration
```

## Success Criteria

- [ ] All scripts executed successfully
- [ ] Root directory clean (only README.md, CLAUDE.md)
- [ ] All files in correct locations
- [ ] Git shows renames, not deletes
- [ ] File counts match expectations
- [ ] Git history preserved (`git log --follow` works)
- [ ] No untracked files
- [ ] No lost content

## Post-Migration Tasks

### Stage Changes
```bash
git add -A
```

### Review Staged Changes
```bash
git status
git diff --cached --stat
```

### Commit
```bash
git commit -m "docs: Refactor documentation structure

- Organize docs into core/, guides/, features/, migrations/, historical/
- Standardize naming conventions (kebab-case)
- Move phase completions to plan-specific folder
- Archive old code review reports
- Clean root directory (only README.md, CLAUDE.md remain)

Resolves documentation organization issues identified in Phase 00-06 completion."
```

## Next Phase

**Phase 05:** Update References & Links (fix all broken links)
