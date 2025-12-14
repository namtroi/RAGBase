# Documentation Refactoring - Visual Guide

## Current State (Messy)

```
SchemaForge/
│
├── 📄 README.md ✅
├── 📄 CLAUDE.md ✅
│
├── 📄 PHASE_00_COMPLETE.md ❌ (scattered)
├── 📄 PHASE_01_COMPLETE.md ❌
├── 📄 PHASE_02_COMPLETE.md ❌
├── 📄 PHASE_03_COMPLETE.md ❌
├── 📄 PHASE_04_COMPLETE.md ❌
├── 📄 PHASE_05_COMPLETE.md ❌
├── 📄 PHASE_06_COMPLETE.md ❌
├── 📄 CODE_REVIEW_SUMMARY.md ❌ (should be archived)
├── 📄 FIX_RECOMMENDATIONS.md ❌
├── 📄 TYPESCRIPT_FIX.md ❌ (historical note)
├── 📄 REMAINING-WORK-PLAN.md ❌ (belongs in plan folder)
│
├── 📁 docs/ (14 files, mixed purpose)
│   ├── 📄 ARCHITECTURE.md ⚠️ (inconsistent naming)
│   ├── 📄 CONTRACT.md ⚠️
│   ├── 📄 OVERVIEW.md ⚠️
│   ├── 📄 ROADMAP.md ⚠️
│   ├── 📄 TEST_STRATEGY.md ⚠️
│   ├── 📄 code-standards.md ✅
│   ├── 📄 codebase-summary.md ✅
│   ├── 📄 FAST_LANE_PROCESSING.md ⚠️ (implementation guide)
│   ├── 📄 FAST_LANE_QUICK_REFERENCE.md ⚠️
│   ├── 📄 FASTEMBED_MIGRATION.md ⚠️ (migration record)
│   ├── 📄 EMBEDDING_TEST_ISSUE.md ⚠️ (debug note)
│   ├── 📄 HELPER_FILES_SOLUTION.md ⚠️
│   └── 📄 TYPESCRIPT_PATH_FIX.md ⚠️
│
└── 📁 plans/
    ├── 📁 2025-12-13-phase1-tdd-implementation/
    │   ├── 📄 plan.md
    │   ├── 📄 phase-00-scaffold-infrastructure.md
    │   ├── 📄 phase-01-test-infrastructure.md
    │   ├── ... (phase files)
    │   ├── 📁 research/
    │   ├── 📁 reports/ ❌ (phase-specific reports mixed)
    │   └── 📁 scout/
    │
    └── 📁 reports/ ⚠️ (active + old reports mixed)
        ├── 📄 code-reviewer-2025-12-14-*.md ✅ (active)
        ├── 📄 code-reviewer-2025-12-13-*.md ⚠️ (should archive)
        └── 📄 project-manager-*.md ✅
```

**Problems:**
- ❌ 10 .md files in root (cluttered)
- ⚠️ Inconsistent naming (CAPS vs kebab-case)
- ⚠️ No clear categorization
- ⚠️ Hard to find what you need

---

## Target State (Organized)

```
SchemaForge/
│
├── 📄 README.md ✅ (navigation hub)
├── 📄 CLAUDE.md ✅ (AI rules)
│
├── 📁 docs/
│   ├── 📄 README.md ✨ (NEW - docs navigation)
│   │
│   ├── 📁 core/ ✨ (essential reading - 7 files)
│   │   ├── 📄 project-overview-pdr.md ✅
│   │   ├── 📄 system-architecture.md ✅
│   │   ├── 📄 api-contracts.md ✅
│   │   ├── 📄 project-roadmap.md ✅
│   │   ├── 📄 testing-strategy.md ✅
│   │   ├── 📄 code-standards.md ✅
│   │   └── 📄 codebase-summary.md ✅
│   │
│   ├── 📁 guides/ ✨ (NEW - how-to docs)
│   │   ├── 📄 quick-start.md
│   │   ├── 📄 development-workflow.md
│   │   ├── 📄 deployment-guide.md
│   │   └── 📄 troubleshooting.md
│   │
│   ├── 📁 features/ ✨ (feature-specific - 2 files)
│   │   ├── 📄 fast-lane-processing.md ✅
│   │   └── 📄 fast-lane-quick-reference.md ✅
│   │
│   ├── 📁 migrations/ ✨ (technical migrations - 1 file)
│   │   ├── 📄 README.md ✨
│   │   └── 📄 fastembed-migration.md ✅
│   │
│   ├── 📁 historical/ ✨ (resolved issues - 4 files)
│   │   ├── 📄 README.md ✨
│   │   ├── 📄 embedding-test-issue.md ✅
│   │   ├── 📄 typescript-path-fix.md ✅
│   │   ├── 📄 typescript-fix.md ✅
│   │   └── 📄 helper-files-solution.md ✅
│   │
│   └── 📁 templates/ ✨ (NEW - documentation templates)
│       ├── 📄 feature-doc-template.md
│       ├── 📄 migration-doc-template.md
│       └── 📄 phase-completion-template.md
│
└── 📁 plans/
    ├── 📄 README.md ✨ (NEW - plans navigation)
    │
    ├── 📁 2025-12-13-phase1-tdd-implementation/
    │   ├── 📄 plan.md
    │   ├── 📄 phase-00-scaffold-infrastructure.md
    │   ├── 📄 phase-01-test-infrastructure.md
    │   ├── ... (phase files)
    │   │
    │   ├── 📁 completion/ ✨ (NEW - phase artifacts - 7 files)
    │   │   ├── 📄 phase-00-complete.md ✅
    │   │   ├── 📄 phase-01-complete.md ✅
    │   │   ├── 📄 phase-02-complete.md ✅
    │   │   ├── 📄 phase-03-complete.md ✅
    │   │   ├── 📄 phase-04-complete.md ✅
    │   │   ├── 📄 phase-05-complete.md ✅
    │   │   └── 📄 phase-06-complete.md ✅
    │   │
    │   ├── 📁 research/
    │   ├── 📁 reports/ (plan-specific reports)
    │   └── 📁 scout/
    │
    ├── 📁 2025-12-14-docs-refactor-organization/
    │   └── (this plan)
    │
    └── 📁 reports/ (global reports)
        ├── 📄 code-reviewer-2025-12-14-*.md ✅ (active)
        ├── 📄 project-manager-*.md ✅
        │
        └── 📁 archive/ ✨ (NEW - old reports)
            ├── 📄 CODE_REVIEW_SUMMARY.md ✅
            ├── 📄 FIX_RECOMMENDATIONS.md ✅
            └── 📄 code-reviewer-2024-*.md ✅
```

**Benefits:**
- ✅ Clean root (only 2 .md files)
- ✅ Clear categorization
- ✅ Consistent naming (all kebab-case)
- ✅ Easy navigation (README indices)
- ✅ Scalable structure

---

## Migration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 01: Audit & Categorization                             │
├─────────────────────────────────────────────────────────────┤
│ • Inventory all files                                        │
│ • Categorize by purpose                                      │
│ • Create file mapping                                        │
│ • Identify duplicates                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 02: Design New Structure                               │
├─────────────────────────────────────────────────────────────┤
│ • Define directory structure                                 │
│ • Establish naming conventions                               │
│ • Create templates                                           │
│ • Design navigation strategy                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 03: Create Migration Scripts                           │
├─────────────────────────────────────────────────────────────┤
│ • Write 9 automation scripts                                 │
│ • Validation checks                                          │
│ • Rollback capability                                        │
│ • Dry-run testing                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 04: Execute Migration                                  │
├─────────────────────────────────────────────────────────────┤
│ • Run master script                                          │
│ • Move files with git mv                                     │
│ • Preserve git history                                       │
│ • Validate results                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 05: Update References & Links                          │
├─────────────────────────────────────────────────────────────┤
│ • Fix broken links                                           │
│ • Create navigation READMEs                                  │
│ • Update cross-references                                    │
│ • Validate all links                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 06: Workflow & Maintenance                             │
├─────────────────────────────────────────────────────────────┤
│ • Setup pre-commit hooks                                     │
│ • Create linting scripts                                     │
│ • Establish review process                                   │
│ • Define maintenance schedule                                │
└─────────────────────────────────────────────────────────────┘
```

---

## File Movement Diagram

### Root Files → New Locations

```
Root Directory                    →    Target Location
──────────────────────────────────────────────────────────────
PHASE_00_COMPLETE.md             →    plans/.../completion/phase-00-complete.md
PHASE_01_COMPLETE.md             →    plans/.../completion/phase-01-complete.md
PHASE_02_COMPLETE.md             →    plans/.../completion/phase-02-complete.md
PHASE_03_COMPLETE.md             →    plans/.../completion/phase-03-complete.md
PHASE_04_COMPLETE.md             →    plans/.../completion/phase-04-complete.md
PHASE_05_COMPLETE.md             →    plans/.../completion/phase-05-complete.md
PHASE_06_COMPLETE.md             →    plans/.../completion/phase-06-complete.md

CODE_REVIEW_SUMMARY.md           →    plans/reports/archive/CODE_REVIEW_SUMMARY.md
FIX_RECOMMENDATIONS.md           →    plans/reports/archive/FIX_RECOMMENDATIONS.md
REVIEW_COMPLETE.txt              →    plans/reports/archive/REVIEW_COMPLETE.txt

TYPESCRIPT_FIX.md                →    docs/historical/typescript-fix.md
REMAINING-WORK-PLAN.md           →    plans/.../remaining-work-plan.md

repomix-output.xml               →    ❌ DELETED (can regenerate)
```

### docs/ Files → New Subdirectories

```
docs/ (root level)                →    docs/core/
──────────────────────────────────────────────────────────────
ARCHITECTURE.md                   →    system-architecture.md
CONTRACT.md                       →    api-contracts.md
OVERVIEW.md                       →    project-overview-pdr.md
ROADMAP.md                        →    project-roadmap.md
TEST_STRATEGY.md                  →    testing-strategy.md
code-standards.md                 →    code-standards.md
codebase-summary.md               →    codebase-summary.md

docs/ (root level)                →    docs/features/
──────────────────────────────────────────────────────────────
FAST_LANE_PROCESSING.md           →    fast-lane-processing.md
FAST_LANE_QUICK_REFERENCE.md      →    fast-lane-quick-reference.md

docs/ (root level)                →    docs/migrations/
──────────────────────────────────────────────────────────────
FASTEMBED_MIGRATION.md            →    fastembed-migration.md

docs/ (root level)                →    docs/historical/
──────────────────────────────────────────────────────────────
EMBEDDING_TEST_ISSUE.md           →    embedding-test-issue.md
HELPER_FILES_SOLUTION.md          →    helper-files-solution.md
TYPESCRIPT_PATH_FIX.md            →    typescript-path-fix.md
```

---

## Navigation Structure

### Before (Flat, Hard to Navigate)

```
📂 All docs in 2 directories
   ├── Root (10 .md files) - cluttered
   └── docs/ (14 .md files) - mixed purpose
```

### After (Hierarchical, Easy to Navigate)

```
📂 README.md (main hub)
   ├── 🔗 Quick Start
   ├── 🔗 Documentation → docs/README.md
   │   ├── 📁 Core Docs (essential)
   │   │   └── 7 foundational documents
   │   │
   │   ├── 📁 Guides (how-to)
   │   │   └── Step-by-step tutorials
   │   │
   │   ├── 📁 Features (specific features)
   │   │   └── Feature documentation
   │   │
   │   ├── 📁 Migrations (technical changes)
   │   │   └── Migration records
   │   │
   │   └── 📁 Historical (reference)
   │       └── Resolved issues
   │
   └── 🔗 Plans → plans/README.md
       ├── 📁 Active Plans
       │   └── Implementation tracking
       │
       └── 📁 Reports
           ├── Active reports
           └── Archived reports
```

---

## Before & After Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Root .md files | 10 | 2 | **80% reduction** |
| Naming consistency | Mixed | All kebab-case | **100% standardized** |
| Categorization | None | 6 categories | **Clear organization** |
| Navigation | Manual search | README indices | **Easy discovery** |
| Maintenance | Manual | Automated | **Scripts + hooks** |
| Scalability | Poor | Excellent | **Ready to grow** |

---

## Success Indicators

### ✅ Root Directory Clean
```bash
ls -1 *.md
# Output:
# README.md
# CLAUDE.md
```

### ✅ Proper Categorization
```bash
tree docs/ -d -L 1
# Output:
# docs/
# ├── core
# ├── features
# ├── guides
# ├── historical
# ├── migrations
# └── templates
```

### ✅ Consistent Naming
```bash
find docs -name "*.md" -not -name "README.md" | xargs basename -a
# All output in kebab-case:
# system-architecture.md
# api-contracts.md
# ...
```

### ✅ No Broken Links
```bash
bash scripts/docs-migration/11-validate-links.sh
# Output: ✅ All links valid
```

### ✅ Git History Preserved
```bash
git log --follow docs/core/system-architecture.md
# Shows full history from when it was ARCHITECTURE.md
```

---

## Quick Reference Card

### Finding Documentation

**Need to get started?**
→ `README.md` → Quick Start

**Need core project info?**
→ `docs/core/project-overview-pdr.md`

**Need architecture details?**
→ `docs/core/system-architecture.md`

**Need API specs?**
→ `docs/core/api-contracts.md`

**Need feature documentation?**
→ `docs/features/{feature-name}.md`

**Need migration history?**
→ `docs/migrations/`

**Need to resolve an issue?**
→ `docs/historical/` (might have been solved before)

**Need implementation plan?**
→ `plans/{date}-{name}/plan.md`

**Need phase completion report?**
→ `plans/{plan-name}/completion/phase-XX-complete.md`

### Creating Documentation

**New feature doc?**
→ Use `docs/templates/feature-doc-template.md`
→ Save to `docs/features/`

**New migration record?**
→ Use `docs/templates/migration-doc-template.md`
→ Save to `docs/migrations/`

**Phase completion?**
→ Use `docs/templates/phase-completion-template.md`
→ Save to `plans/{plan-name}/completion/`

**Always:**
1. Use kebab-case naming
2. Add frontmatter metadata
3. Update relevant README
4. Validate links before committing
