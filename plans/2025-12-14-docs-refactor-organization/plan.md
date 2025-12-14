# Documentation Refactoring & Organization Plan

**Status:** Planning
**Priority:** High
**Target:** Clean, maintainable, discoverable documentation structure

## Current State Analysis

### Root Directory (Messy)
- 7 PHASE_XX_COMPLETE.md files (Phase 00-06)
- CODE_REVIEW_SUMMARY.md
- FIX_RECOMMENDATIONS.md
- REMAINING-WORK-PLAN.md
- TYPESCRIPT_FIX.md
- REVIEW_COMPLETE.txt

### docs/ Directory (Mixed Purpose)
- Core: ARCHITECTURE.md, CONTRACT.md, OVERVIEW.md, ROADMAP.md, TEST_STRATEGY.md
- Implementation: FAST_LANE_PROCESSING.md, FAST_LANE_QUICK_REFERENCE.md
- Technical: FASTEMBED_MIGRATION.md, EMBEDDING_TEST_ISSUE.md
- Meta: codebase-summary.md, code-standards.md
- Fixes: HELPER_FILES_SOLUTION.md, TYPESCRIPT_PATH_FIX.md

### plans/ Directory Structure
```
plans/
├── 2025-12-13-phase1-tdd-implementation/
│   ├── phase-XX.md (10 files)
│   ├── TASK-XX-COMPLETE.md
│   ├── E2E-XX.md
│   ├── research/
│   ├── reports/
│   └── scout/
└── reports/ (18 code reviews, project summaries)
```

## Problems Identified

1. **Phase completion docs scattered** (root vs plans/)
2. **Code reviews mixed** (root, docs/, plans/reports/)
3. **No clear home for**: Implementation guides, migration docs, debugging notes
4. **Duplication risk**: Multiple summaries, multiple roadmaps
5. **Discovery difficulty**: Users can't find what they need quickly

## Quick Links

- **[📋 Executive Summary](SUMMARY.md)** - Overview, benefits, quick start
- **[🎨 Visual Guide](VISUAL-GUIDE.md)** - Before/after diagrams, migration flow
- **[📊 Phase Details](#phases-overview)** - Detailed implementation phases

## Phases Overview

| Phase | Description | Complexity | Time | Status |
|-------|-------------|------------|------|--------|
| [01](phase-01-audit-categorization.md) | Audit & Categorization | Low | 30 min | Ready |
| [02](phase-02-design-new-structure.md) | Design New Structure | Medium | 1 hr | Ready |
| [03](phase-03-migration-scripts.md) | Create Migration Scripts | Medium | 1.5 hr | Ready |
| [04](phase-04-execute-migration.md) | Execute Migration | Low | 30 min | After 03 |
| [05](phase-05-update-references.md) | Update References & Links | Medium | 1 hr | After 04 |
| [06](phase-06-workflow-maintenance.md) | Workflow & Maintenance | Medium | 1 hr | After 05 |

**Total Time:** 4-6 hours

## Success Criteria

- [ ] Zero markdown files in root (except README.md, CLAUDE.md)
- [ ] Clear separation: Core docs vs Implementation artifacts vs Historical records
- [ ] Single source of truth for each doc type
- [ ] Easy navigation via updated README links
- [ ] Automated sync workflow defined
- [ ] Git history preserved for all files
- [ ] No broken internal links
- [ ] Pre-commit hooks and linting configured

## Key Deliverables

### New Directory Structure
```
docs/
├── core/          # 7 essential docs
├── guides/        # How-to documentation
├── features/      # Feature-specific docs
├── migrations/    # Technical migrations
├── historical/    # Resolved issues
└── templates/     # Documentation templates
```

### Automation Scripts
- Migration scripts (9 scripts)
- Link validation
- Documentation linting
- Stats generation

### Navigation Indices
- docs/README.md
- plans/README.md
- docs/historical/README.md
- docs/migrations/README.md

### Templates
- Feature documentation
- Migration documentation
- Phase completion

## Quick Start

```bash
# Review the plan
cat plans/2025-12-14-docs-refactor-organization/SUMMARY.md

# Execute migration (all phases)
bash scripts/docs-migration/run-migration.sh

# Validate results
bash scripts/docs-migration/11-validate-links.sh

# Commit
git add -A
git commit -m "docs: Refactor documentation structure"
```

## Rollback

```bash
# If issues arise before committing
git reset --hard HEAD
```
