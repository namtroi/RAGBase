# Documentation Refactoring & Organization Plan

**Created:** 2025-12-14
**Status:** Ready for Implementation
**Complexity:** Medium (mostly automated)
**Est. Time:** 4-6 hours

## 🎯 Objective

Transform SchemaForge's scattered documentation into a clean, maintainable, discoverable structure.

## 📚 Documentation

### Start Here

1. **[📋 SUMMARY.md](SUMMARY.md)** - Executive summary with quick start guide
2. **[🎨 VISUAL-GUIDE.md](VISUAL-GUIDE.md)** - Visual before/after comparison
3. **[📊 plan.md](plan.md)** - Main plan overview

### Implementation Phases

1. **[Phase 01: Audit & Categorization](phase-01-audit-categorization.md)** - Inventory and categorize all files (30 min)
2. **[Phase 02: Design New Structure](phase-02-design-new-structure.md)** - Define organization strategy (1 hr)
3. **[Phase 03: Migration Scripts](phase-03-migration-scripts.md)** - Create automation scripts (1.5 hr)
4. **[Phase 04: Execute Migration](phase-04-execute-migration.md)** - Run migration (30 min)
5. **[Phase 05: Update References](phase-05-update-references.md)** - Fix links and navigation (1 hr)
6. **[Phase 06: Workflow & Maintenance](phase-06-workflow-maintenance.md)** - Setup ongoing processes (1 hr)

## 🚀 Quick Start

### Prerequisites
```bash
git status  # Ensure clean state
git checkout -b docs/refactor-organization
```

### Execute
```bash
# Run entire migration
bash scripts/docs-migration/run-migration.sh

# Validate results
bash scripts/docs-migration/11-validate-links.sh

# Commit changes
git add -A
git commit -m "docs: Refactor documentation structure"
```

### Rollback (if needed)
```bash
git reset --hard HEAD
```

## 📊 What Gets Reorganized

### Files Moved (Total: 27 files)

**From Root → plans/.../completion/** (7 files)
- PHASE_00_COMPLETE.md → phase-00-complete.md
- ... through phase-06-complete.md

**From docs/ → docs/core/** (7 files, renamed)
- ARCHITECTURE.md → system-architecture.md
- CONTRACT.md → api-contracts.md
- OVERVIEW.md → project-overview-pdr.md
- ROADMAP.md → project-roadmap.md
- TEST_STRATEGY.md → testing-strategy.md
- code-standards.md
- codebase-summary.md

**From docs/ → docs/features/** (2 files)
- FAST_LANE_PROCESSING.md → fast-lane-processing.md
- FAST_LANE_QUICK_REFERENCE.md → fast-lane-quick-reference.md

**From docs/ → docs/migrations/** (1 file)
- FASTEMBED_MIGRATION.md → fastembed-migration.md

**From docs/ + Root → docs/historical/** (4 files)
- EMBEDDING_TEST_ISSUE.md → embedding-test-issue.md
- HELPER_FILES_SOLUTION.md → helper-files-solution.md
- TYPESCRIPT_PATH_FIX.md → typescript-path-fix.md
- TYPESCRIPT_FIX.md → typescript-fix.md

**From Root → plans/reports/archive/** (3 files)
- CODE_REVIEW_SUMMARY.md
- FIX_RECOMMENDATIONS.md
- REVIEW_COMPLETE.txt

**Deleted** (1 file)
- repomix-output.xml (can regenerate)

## 🎁 Deliverables

### New Structure
```
docs/
├── README.md                 # Navigation index
├── core/                     # 7 essential docs
├── guides/                   # How-to docs (future)
├── features/                 # 2 feature guides
├── migrations/               # 1 migration record
├── historical/               # 4 resolved issues
└── templates/                # Doc templates
```

### Automation
- 9 migration scripts
- Link validation script
- Documentation linting
- Stats generation

### Navigation
- Root README updated
- docs/README.md created
- plans/README.md created
- Historical/migrations indices

## ✅ Success Criteria

- [ ] Root clean (only README.md, CLAUDE.md)
- [ ] All docs categorized properly
- [ ] Consistent kebab-case naming
- [ ] No broken links
- [ ] Git history preserved
- [ ] Navigation indices created
- [ ] Automation configured

## 📖 Documentation Standards

### Naming Convention
- **Use kebab-case:** `fast-lane-processing.md`
- **Be descriptive:** Self-documenting file names
- **Avoid abbreviations:** Unless standard (API, PDF)

### File Organization
- **Core docs** → Essential project understanding
- **Guides** → How-to tutorials
- **Features** → Feature-specific documentation
- **Migrations** → Technical migration records
- **Historical** → Resolved issues, debugging notes

### Frontmatter (all docs)
```yaml
---
title: Document Title
status: Draft|In Progress|Completed
phase: XX
last_updated: YYYY-MM-DD
tags: [tag1, tag2]
---
```

## 🔧 Maintenance

### Weekly
- Review outdated docs (>90 days)
- Check open TODOs
- Validate links

### Monthly
- Archive completed phases
- Clean historical docs
- Update roadmap
- Sync code standards

## ❓ FAQ

**Q: Will git history be lost?**
A: No, using `git mv` preserves full history.

**Q: Can we rollback?**
A: Yes, `git reset --hard HEAD` before committing.

**Q: How long does this take?**
A: 4-6 hours total, can be staged.

**Q: Will links break?**
A: Temporarily, but Phase 05 fixes all links.

**Q: Do we need downtime?**
A: No, documentation only.

## 🤝 Contributing

After migration, follow these rules:

1. **Choose correct directory** for new docs
2. **Use templates** from `docs/templates/`
3. **Follow naming convention** (kebab-case)
4. **Add frontmatter** metadata
5. **Update navigation** READMEs
6. **Validate links** before committing

## 📞 Support

**Issues?** Check troubleshooting in Phase 04
**Questions?** Review SUMMARY.md and VISUAL-GUIDE.md
**Feedback?** Open issue or discuss with team

---

**Next Steps:**
1. Review [SUMMARY.md](SUMMARY.md) for overview
2. Check [VISUAL-GUIDE.md](VISUAL-GUIDE.md) for visual comparison
3. Follow phases 01-06 in order
4. Execute migration when ready
