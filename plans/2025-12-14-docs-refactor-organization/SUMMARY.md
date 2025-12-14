# Documentation Refactoring Plan - Executive Summary

**Created:** 2025-12-14
**Status:** Ready for implementation
**Complexity:** Medium (mostly scripted)
**Estimated Time:** 4-6 hours total

## Problem Statement

After completing Phase 00-06 of the TDD implementation, documentation is scattered across:
- **Root directory:** 7 PHASE_XX_COMPLETE.md files + review summaries
- **docs/ directory:** Mix of core docs, implementation guides, debug notes (14 files)
- **plans/ directory:** Plan files mixed with completion artifacts

**Issues:**
- Poor discoverability
- No clear categorization
- Inconsistent naming
- Difficult to maintain
- Risk of duplication

## Solution Overview

**Reorganize documentation into clear, purpose-driven structure:**

```
docs/
├── core/               # Essential project docs (7 files)
├── guides/             # How-to documentation (new)
├── features/           # Feature-specific docs (2 files)
├── migrations/         # Technical migrations (1 file)
├── historical/         # Resolved issues (4 files)
└── templates/          # Documentation templates (new)

plans/
├── {plan-name}/
│   ├── completion/     # Phase artifacts (7 files)
│   ├── reports/        # Code reviews
│   ├── research/
│   └── scout/
└── reports/
    └── archive/        # Old reports (3 files)
```

**Root directory:** Clean (only README.md, CLAUDE.md)

## Implementation Approach

### 6 Phases

| Phase | What | Complexity | Time |
|-------|------|------------|------|
| 01 | Audit & Categorization | Low | 30 min |
| 02 | Design New Structure | Medium | 1 hr |
| 03 | Create Migration Scripts | Medium | 1.5 hr |
| 04 | Execute Migration | Low | 30 min |
| 05 | Update References & Links | Medium | 1 hr |
| 06 | Workflow & Maintenance | Medium | 1 hr |

### Key Features

✅ **Automated migration** - Scripts handle file moves
✅ **Git history preserved** - Uses `git mv` not `mv`
✅ **Link validation** - Automated broken link detection
✅ **Rollback capability** - Safe to revert if issues
✅ **Navigation indices** - README files for discovery
✅ **Ongoing maintenance** - Pre-commit hooks, linting

## Quick Start

### Prerequisites
```bash
# Clean git state
git status  # Should be clean
git checkout -b docs/refactor-organization
```

### Execute Migration
```bash
# Run all phases at once
cd D:/14-osp/SchemaForge
bash scripts/docs-migration/run-migration.sh

# Validate results
bash scripts/docs-migration/11-validate-links.sh

# Commit
git add -A
git commit -m "docs: Refactor documentation structure"
```

### Rollback if Needed
```bash
git reset --hard HEAD
```

## Expected Outcomes

### Before (Current)
```
.
├── PHASE_00_COMPLETE.md
├── PHASE_01_COMPLETE.md
├── ...
├── CODE_REVIEW_SUMMARY.md
├── FIX_RECOMMENDATIONS.md
├── TYPESCRIPT_FIX.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRACT.md
│   ├── FAST_LANE_PROCESSING.md
│   └── ... (14 files, mixed purpose)
└── plans/
    └── ... (completion docs in root)
```

### After (Target)
```
.
├── README.md          # Navigation hub
├── CLAUDE.md          # AI rules
├── docs/
│   ├── README.md      # Docs index
│   ├── core/          # 7 essential docs
│   ├── features/      # 2 feature guides
│   ├── migrations/    # 1 migration record
│   ├── historical/    # 4 debug notes
│   └── templates/     # Doc templates
└── plans/
    ├── README.md
    ├── 2025-12-13-phase1-tdd-implementation/
    │   └── completion/   # 7 phase completions
    └── reports/
        └── archive/      # 3 old reviews
```

## File Migration Summary

### Root → plans/.../completion/ (7 files)
- PHASE_00_COMPLETE.md → phase-00-complete.md
- PHASE_01_COMPLETE.md → phase-01-complete.md
- ... through Phase 06

### docs/ → docs/core/ (7 files, renamed)
- ARCHITECTURE.md → system-architecture.md
- CONTRACT.md → api-contracts.md
- OVERVIEW.md → project-overview-pdr.md
- ROADMAP.md → project-roadmap.md
- TEST_STRATEGY.md → testing-strategy.md
- code-standards.md → code-standards.md
- codebase-summary.md → codebase-summary.md

### docs/ → docs/features/ (2 files)
- FAST_LANE_PROCESSING.md → fast-lane-processing.md
- FAST_LANE_QUICK_REFERENCE.md → fast-lane-quick-reference.md

### docs/ → docs/migrations/ (1 file)
- FASTEMBED_MIGRATION.md → fastembed-migration.md

### docs/ → docs/historical/ (4 files)
- EMBEDDING_TEST_ISSUE.md → embedding-test-issue.md
- HELPER_FILES_SOLUTION.md → helper-files-solution.md
- TYPESCRIPT_PATH_FIX.md → typescript-path-fix.md
- (root) TYPESCRIPT_FIX.md → typescript-fix.md

### Root → plans/reports/archive/ (3 files)
- CODE_REVIEW_SUMMARY.md
- FIX_RECOMMENDATIONS.md
- REVIEW_COMPLETE.txt

### Deleted (can regenerate)
- repomix-output.xml

## Benefits

### Immediate
- ✅ Clean root directory (only 2 .md files)
- ✅ Clear categorization
- ✅ Easy navigation
- ✅ Consistent naming (kebab-case)

### Long-term
- ✅ Maintainable structure
- ✅ Scalable (add new docs without clutter)
- ✅ Discoverable (README indices)
- ✅ Automated quality checks

## Risk Mitigation

### Low Risk
- Uses `git mv` (preserves history)
- Automated scripts (consistent)
- Validation built-in
- Easy rollback

### Potential Issues & Solutions

| Issue | Solution |
|-------|----------|
| Broken links after migration | Phase 05 updates all links |
| Lost git history | Using `git mv` preserves it |
| Script fails mid-way | Rollback with `git reset --hard` |
| Team confusion | README navigation + communication |

## Success Criteria

- [ ] Zero .md files in root (except README, CLAUDE)
- [ ] All docs categorized correctly
- [ ] No broken internal links
- [ ] Git history preserved
- [ ] Navigation READMEs created
- [ ] Automated validation passes
- [ ] Team can find docs easily

## Next Actions

1. **Review this plan** - Get team buy-in
2. **Schedule migration** - Low-traffic time
3. **Create backup branch** - Safety net
4. **Execute Phase 01-06** - Follow phase docs
5. **Validate results** - Run validation scripts
6. **Communicate changes** - Update team
7. **Monitor adoption** - Gather feedback

## Documentation

**Full phase details:**
- [Phase 01: Audit & Categorization](phase-01-audit-categorization.md)
- [Phase 02: Design New Structure](phase-02-design-new-structure.md)
- [Phase 03: Migration Scripts](phase-03-migration-scripts.md)
- [Phase 04: Execute Migration](phase-04-execute-migration.md)
- [Phase 05: Update References](phase-05-update-references.md)
- [Phase 06: Workflow & Maintenance](phase-06-workflow-maintenance.md)

## Questions?

**Common questions answered:**

**Q: Will we lose git history?**
A: No, using `git mv` preserves full history.

**Q: Can we rollback?**
A: Yes, `git reset --hard HEAD` before committing.

**Q: How long will this take?**
A: 4-6 hours total, can be done in stages.

**Q: Will links break?**
A: Temporarily, but Phase 05 fixes all links automatically.

**Q: Do we need downtime?**
A: No, this is documentation only.

**Q: What if a script fails?**
A: Rollback and debug, or run phases manually.
