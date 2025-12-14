# Phase 05: Update References & Links

**Priority:** High
**Status:** Ready after Phase 04
**Estimated Complexity:** Medium

## Overview

Fix all broken links and references after documentation migration. Ensure all internal links use correct relative paths.

## Discovery Phase

### Step 1: Find All Internal Links
```bash
# Search for markdown links
grep -r "\[.*\](.*\.md)" --include="*.md" . > link-inventory.txt

# Search for absolute paths (these are broken)
grep -r "\[.*\](/.*\.md)" --include="*.md" .

# Search for specific file references
grep -r "ARCHITECTURE.md" --include="*.md" .
grep -r "CONTRACT.md" --include="*.md" .
grep -r "OVERVIEW.md" --include="*.md" .
```

### Step 2: Categorize Links

**Categories:**
1. **Root README.md links** → Update to new paths
2. **docs/ internal links** → Update to new subdirectory structure
3. **plans/ references** → Update to new completion/ folder
4. **CLAUDE.md workflow links** → Update paths
5. **Code comments** → Update documentation references

## Link Update Mapping

### Root README.md Updates

**Before:**
```markdown
- [OVERVIEW.md](docs/OVERVIEW.md)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [CONTRACT.md](docs/CONTRACT.md)
- [TEST_STRATEGY.md](docs/TEST_STRATEGY.md)
- [ROADMAP.md](docs/ROADMAP.md)
```

**After:**
```markdown
- [Project Overview](docs/core/project-overview-pdr.md)
- [System Architecture](docs/core/system-architecture.md)
- [API Contracts](docs/core/api-contracts.md)
- [Testing Strategy](docs/core/testing-strategy.md)
- [Project Roadmap](docs/core/project-roadmap.md)
```

### CLAUDE.md Workflow Links

**Before:**
```markdown
- Primary workflow: `./.claude/workflows/primary-workflow.md`
```

**After:** (No change - workflows stay in .claude/)

### docs/ Internal Cross-References

**Example from system-architecture.md:**

**Before:**
```markdown
See [CONTRACT.md](CONTRACT.md) for API details.
See [TEST_STRATEGY.md](TEST_STRATEGY.md) for testing.
```

**After:**
```markdown
See [API Contracts](api-contracts.md) for API details.
See [Testing Strategy](testing-strategy.md) for testing.
```

### Phase Plan References

**Example from plans/2025-12-13-phase1-tdd-implementation/plan.md:**

**Before:**
```markdown
- [x] **Phase 00:** See [PHASE_00_COMPLETE.md](../../PHASE_00_COMPLETE.md)
```

**After:**
```markdown
- [x] **Phase 00:** See [completion/phase-00-complete.md](completion/phase-00-complete.md)
```

## Automated Link Update Script

**File:** `scripts/docs-migration/10-update-links.sh`

```bash
#!/bin/bash
# Updates internal documentation links

set -e

echo "=== Updating Documentation Links ==="

# Function to update links in a file
update_file_links() {
  local file=$1
  echo "Processing: $file"

  # Update old doc names to new names (case-insensitive)
  sed -i 's|\[.*\](docs/ARCHITECTURE\.md)|[System Architecture](docs/core/system-architecture.md)|g' "$file"
  sed -i 's|\[.*\](docs/CONTRACT\.md)|[API Contracts](docs/core/api-contracts.md)|g' "$file"
  sed -i 's|\[.*\](docs/OVERVIEW\.md)|[Project Overview](docs/core/project-overview-pdr.md)|g' "$file"
  sed -i 's|\[.*\](docs/ROADMAP\.md)|[Project Roadmap](docs/core/project-roadmap.md)|g' "$file"
  sed -i 's|\[.*\](docs/TEST_STRATEGY\.md)|[Testing Strategy](docs/core/testing-strategy.md)|g' "$file"

  # Update phase completion references
  for phase in {00..06}; do
    sed -i "s|PHASE_${phase}_COMPLETE\.md|plans/2025-12-13-phase1-tdd-implementation/completion/phase-${phase}-complete.md|g" "$file"
  done

  # Update feature doc references
  sed -i 's|docs/FAST_LANE_PROCESSING\.md|docs/features/fast-lane-processing.md|g' "$file"
  sed -i 's|docs/FAST_LANE_QUICK_REFERENCE\.md|docs/features/fast-lane-quick-reference.md|g' "$file"

  # Update migration doc references
  sed -i 's|docs/FASTEMBED_MIGRATION\.md|docs/migrations/fastembed-migration.md|g' "$file"
}

# Update README.md
update_file_links "README.md"

# Update all docs
find docs -name "*.md" -type f | while read -r file; do
  update_file_links "$file"
done

# Update plan files
find plans -name "*.md" -type f | while read -r file; do
  update_file_links "$file"
done

echo "✅ Links updated"
```

## Manual Link Updates

### Files Requiring Manual Review

1. **README.md** - Main navigation hub
2. **docs/core/*.md** - Cross-references between core docs
3. **plans/2025-12-13-phase1-tdd-implementation/plan.md** - Phase overview
4. **.claude/workflows/*.md** - Workflow documentation references

### Link Validation Checklist

For each file, verify:
- [ ] Internal links work
- [ ] Relative paths correct
- [ ] No absolute paths (`/docs/...`)
- [ ] Link text is descriptive
- [ ] Referenced files exist

## Create Navigation READMEs

### docs/README.md

**File:** `docs/README.md`

```markdown
# Documentation Index

Welcome to SchemaForge documentation.

## Getting Started

1. [Project Overview](core/project-overview-pdr.md) - What is SchemaForge?
2. [System Architecture](core/system-architecture.md) - How it works
3. [Quick Start](../README.md#quick-start) - Get running in 5 minutes

## Core Documentation

Essential reading for all developers:

- [Project Overview PDR](core/project-overview-pdr.md) - Vision, goals, scope
- [System Architecture](core/system-architecture.md) - Technical design
- [API Contracts](core/api-contracts.md) - API specifications
- [Testing Strategy](core/testing-strategy.md) - TDD approach
- [Code Standards](core/code-standards.md) - Coding conventions
- [Project Roadmap](core/project-roadmap.md) - Development phases
- [Codebase Summary](core/codebase-summary.md) - Project structure

## Guides

How-to documentation:

- [Development Workflow](guides/development-workflow.md) - Daily development
- [Deployment Guide](guides/deployment-guide.md) - Production deployment
- [Troubleshooting](guides/troubleshooting.md) - Common issues

## Features

Feature-specific documentation:

- [Fast Lane Processing](features/fast-lane-processing.md) - High-speed text processing
- [Fast Lane Quick Reference](features/fast-lane-quick-reference.md) - Quick lookup

## Technical Reference

- [Migrations](migrations/) - Technical migration documentation
- [Historical Notes](historical/) - Resolved issues and debugging notes

## Templates

- [Feature Documentation Template](templates/feature-doc-template.md)
- [Migration Documentation Template](templates/migration-doc-template.md)
```

### plans/README.md

**File:** `plans/README.md`

```markdown
# Implementation Plans

This directory contains all implementation plans and execution artifacts.

## Active Plans

- [Phase 1 TDD Implementation](2025-12-13-phase1-tdd-implementation/) - Core pipeline development
- [Documentation Refactoring](2025-12-14-docs-refactor-organization/) - Docs organization

## Plan Structure

Each plan follows this structure:

```
plans/{date}-{name}/
├── plan.md              # Overview & phases
├── phase-XX-*.md        # Detailed phase plans
├── completion/          # Phase completion reports
├── research/            # Research agent reports
├── reports/             # Code reviews, summaries
└── scout/               # Codebase analysis
```

## Reports

- [Active Reports](reports/) - Ongoing code reviews, project summaries
- [Archive](reports/archive/) - Historical reports

## Templates

- [Phase Template](templates/phase-template.md)
- [Plan Template](templates/plan-template.md)
```

### docs/historical/README.md

**File:** `docs/historical/README.md`

```markdown
# Historical Documentation

This directory contains resolved issues, debugging notes, and technical fixes for future reference.

## What's Here

- **Debugging Notes:** Issues encountered during development and how they were resolved
- **Technical Fixes:** Workarounds and solutions for specific problems
- **Migration Notes:** Records of technical debt and migrations

## Files

- [embedding-test-issue.md](embedding-test-issue.md) - Embedding test issues and resolution
- [typescript-path-fix.md](typescript-path-fix.md) - TypeScript path alias configuration
- [typescript-fix.md](typescript-fix.md) - TypeScript compilation fixes
- [helper-files-solution.md](helper-files-solution.md) - Test helper file organization

## Why Keep These?

These documents help future developers:
- Understand why certain decisions were made
- Avoid repeating past mistakes
- Learn from debugging approaches
- Trace technical debt evolution
```

### docs/migrations/README.md

**File:** `docs/migrations/README.md`

```markdown
# Migration Documentation

Records of major technical migrations in the project.

## Completed Migrations

- [FastEmbed Migration](fastembed-migration.md) - Migration from @xenova/transformers to fastembed

## Migration Template

Use [this template](../templates/migration-doc-template.md) for documenting future migrations.
```

## Link Validation Script

**File:** `scripts/docs-migration/11-validate-links.sh`

```bash
#!/bin/bash
# Validates all internal markdown links

set -e

echo "=== Validating Documentation Links ==="

BROKEN_LINKS=0

# Find all markdown files
find . -name "*.md" -type f | while read -r file; do
  # Extract all local markdown links
  grep -oP '\[.*?\]\(\K[^)]+\.md' "$file" 2>/dev/null | while read -r link; do
    # Resolve relative path
    dir=$(dirname "$file")
    target="$dir/$link"

    # Normalize path
    target=$(realpath --relative-to=. "$target" 2>/dev/null || echo "$target")

    if [[ ! -f "$target" ]]; then
      echo "❌ Broken link in $file: $link → $target"
      BROKEN_LINKS=$((BROKEN_LINKS + 1))
    fi
  done
done

if [[ $BROKEN_LINKS -eq 0 ]]; then
  echo "✅ All links valid"
  exit 0
else
  echo "❌ Found $BROKEN_LINKS broken links"
  exit 1
fi
```

## Implementation Steps

### Step 1: Run Link Discovery
```bash
bash scripts/docs-migration/10-update-links.sh
```

### Step 2: Create Navigation READMEs
```bash
# Create each README file manually or via script
```

### Step 3: Manual Review
- Open key files (README.md, docs/core/*.md)
- Click through all links
- Fix any broken references

### Step 4: Validate Links
```bash
bash scripts/docs-migration/11-validate-links.sh
```

### Step 5: Commit Updates
```bash
git add -A
git commit -m "docs: Update all internal documentation links

- Fix references to moved documentation files
- Create navigation README files
- Standardize link text and paths
- Add documentation indices"
```

## Success Criteria

- [ ] All links in README.md work
- [ ] All links in docs/ work
- [ ] All links in plans/ work
- [ ] Navigation READMEs created
- [ ] Link validation script passes
- [ ] No absolute paths used
- [ ] Link text is descriptive

## Next Phase

**Phase 06:** Documentation Workflow & Maintenance (define ongoing processes)
