# Phase 01: Audit & Categorization

**Priority:** High
**Status:** Ready to implement
**Estimated Complexity:** Low

## Overview

Systematically audit all documentation files, categorize by purpose, and identify migration destinations.

## File Inventory

### Root Directory Files to Migrate

| File | Category | Proposed Destination |
|------|----------|---------------------|
| PHASE_00_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| PHASE_01_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| PHASE_02_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| PHASE_03_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| PHASE_04_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| PHASE_05_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| PHASE_06_COMPLETE.md | Phase Artifact | plans/2025-12-13-phase1-tdd-implementation/completion/ |
| CODE_REVIEW_SUMMARY.md | Code Review | plans/reports/archive/ |
| FIX_RECOMMENDATIONS.md | Code Review | plans/reports/archive/ |
| REVIEW_COMPLETE.txt | Code Review | plans/reports/archive/ |
| REMAINING-WORK-PLAN.md | Planning | plans/2025-12-13-phase1-tdd-implementation/ |
| TYPESCRIPT_FIX.md | Technical Note | docs/historical/ |
| repomix-output.xml | Build Artifact | DELETE (can regenerate) |

### docs/ Directory Files to Reorganize

| File | Current Purpose | Action |
|------|----------------|--------|
| ARCHITECTURE.md | Core Doc | KEEP (rename to system-architecture.md) |
| CONTRACT.md | Core Doc | KEEP (rename to api-contracts.md) |
| OVERVIEW.md | Core Doc | KEEP (rename to project-overview-pdr.md) |
| ROADMAP.md | Core Doc | KEEP (rename to project-roadmap.md) |
| TEST_STRATEGY.md | Core Doc | KEEP (rename to testing-strategy.md) |
| code-standards.md | Core Doc | KEEP |
| codebase-summary.md | Core Doc | KEEP |
| FAST_LANE_PROCESSING.md | Implementation Guide | MOVE to docs/implementation-guides/ |
| FAST_LANE_QUICK_REFERENCE.md | Implementation Guide | MOVE to docs/implementation-guides/ |
| FASTEMBED_MIGRATION.md | Migration Doc | MOVE to docs/migrations/ |
| EMBEDDING_TEST_ISSUE.md | Debug Note | MOVE to docs/historical/ |
| HELPER_FILES_SOLUTION.md | Debug Note | MOVE to docs/historical/ |
| TYPESCRIPT_PATH_FIX.md | Debug Note | MOVE to docs/historical/ |

### plans/ Directory Structure

**Keep as-is, but enhance:**
- Add `completion/` subfolder for PHASE_XX_COMPLETE.md files
- Keep reports/ for ongoing code reviews
- Archive old reviews to reports/archive/

## Documentation Categories

### 1. Core Documentation (docs/)
**Purpose:** Essential project understanding
**Audience:** New developers, contributors
**Naming:** descriptive-kebab-case.md
**Files:**
- project-overview-pdr.md (was OVERVIEW.md)
- system-architecture.md (was ARCHITECTURE.md)
- api-contracts.md (was CONTRACT.md)
- project-roadmap.md (was ROADMAP.md)
- testing-strategy.md (was TEST_STRATEGY.md)
- code-standards.md
- codebase-summary.md

### 2. Implementation Guides (docs/implementation-guides/)
**Purpose:** How-to guides for specific features
**Audience:** Developers implementing features
**Files:**
- fast-lane-processing.md
- fast-lane-quick-reference.md

### 3. Migration Documentation (docs/migrations/)
**Purpose:** Record of major technical migrations
**Audience:** Maintainers, future reference
**Files:**
- fastembed-migration.md

### 4. Historical Notes (docs/historical/)
**Purpose:** Debugging notes, issues resolved
**Audience:** Future debugging reference
**Files:**
- embedding-test-issue.md
- helper-files-solution.md
- typescript-path-fix.md
- typescript-fix.md (from root)

### 5. Plan Artifacts (plans/{plan-name}/)
**Purpose:** Implementation tracking, phase completion
**Audience:** Project managers, developers
**Structure:**
```
plans/2025-12-13-phase1-tdd-implementation/
├── completion/
│   ├── phase-00-complete.md
│   ├── phase-01-complete.md
│   └── ...
├── reports/
├── research/
├── scout/
└── phase-XX.md files
```

### 6. Code Review Archive (plans/reports/archive/)
**Purpose:** Historical code reviews
**Audience:** Reference only
**Files:** All old code review reports

## Implementation Steps

### Step 1: Create Directory Structure
```bash
mkdir -p docs/implementation-guides
mkdir -p docs/migrations
mkdir -p docs/historical
mkdir -p plans/2025-12-13-phase1-tdd-implementation/completion
mkdir -p plans/reports/archive
```

### Step 2: Prepare File Mapping Spreadsheet
Create a CSV/JSON file mapping:
- source_path
- destination_path
- action (MOVE, RENAME, DELETE, KEEP)
- category

### Step 3: Validate No Duplicate Content
Before migration, check for:
- Duplicate summaries
- Conflicting versions
- Outdated content

### Step 4: Document Current Links
Scan all .md files for internal links:
```bash
grep -r "\[.*\](.*\.md)" docs/ plans/ *.md > link-inventory.txt
```

## Success Criteria

- [ ] All files categorized
- [ ] Directory structure created
- [ ] File mapping document created
- [ ] No duplicate content identified
- [ ] Current link inventory created
- [ ] Zero breaking changes to existing workflows

## Next Phase

**Phase 02:** Design New Structure (standardize naming, create templates)
