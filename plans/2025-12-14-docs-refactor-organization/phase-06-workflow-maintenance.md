# Phase 06: Documentation Workflow & Maintenance

**Priority:** Medium
**Status:** Ready after Phase 05
**Estimated Complexity:** Medium

## Overview

Establish processes, automation, and guidelines for maintaining documentation quality and organization going forward.

## Documentation Lifecycle

### 1. Creation Phase

**When creating new documentation:**

1. **Identify category:**
   - Core doc? → `docs/core/`
   - Feature guide? → `docs/features/`
   - Migration record? → `docs/migrations/`
   - Debugging note? → `docs/historical/`

2. **Use appropriate template:**
   - Feature docs: `docs/templates/feature-doc-template.md`
   - Migrations: `docs/templates/migration-doc-template.md`
   - Phase completions: `docs/templates/phase-completion-template.md`

3. **Add metadata:**
   ```yaml
   ---
   title: Feature Name
   status: Draft|In Progress|Completed
   phase: XX
   last_updated: YYYY-MM-DD
   tags: [tag1, tag2]
   ---
   ```

4. **Follow naming convention:**
   - Use kebab-case
   - Be descriptive (self-documenting)
   - Keep under 50 characters

5. **Update navigation:**
   - Add link to relevant README.md
   - Update parent index if needed

### 2. Update Phase

**When updating existing documentation:**

1. **Update metadata:**
   - Change `last_updated` date
   - Update `status` if needed

2. **Check for broken links:**
   ```bash
   bash scripts/docs-migration/11-validate-links.sh
   ```

3. **Commit with conventional commit:**
   ```bash
   git commit -m "docs: Update fast-lane processing guide

   - Add new configuration options
   - Update performance benchmarks
   - Fix broken links"
   ```

### 3. Archive Phase

**When documentation becomes obsolete:**

1. **Don't delete** - move to `docs/historical/`
2. **Add deprecation notice** at top:
   ```markdown
   > ⚠️ **DEPRECATED:** This document is outdated. See [new-doc.md](../features/new-doc.md) instead.
   ```
3. **Update navigation** - remove from main indices
4. **Document reason** for deprecation

## Automated Documentation Tasks

### Pre-Commit Hook

**File:** `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Pre-commit hook for documentation validation

# Check for broken links in staged markdown files
STAGED_MD=$(git diff --cached --name-only --diff-filter=ACM | grep '\.md$')

if [[ -n "$STAGED_MD" ]]; then
  echo "Validating documentation links..."

  for file in $STAGED_MD; do
    # Check for absolute paths
    if grep -q "\[.*\](/.*\.md)" "$file"; then
      echo "❌ Error: Absolute path detected in $file"
      echo "   Use relative paths instead"
      exit 1
    fi

    # Check for old doc names
    if grep -qE "(ARCHITECTURE|CONTRACT|OVERVIEW|ROADMAP|TEST_STRATEGY)\.md" "$file"; then
      echo "❌ Error: Old doc name detected in $file"
      echo "   Update to new naming convention"
      exit 1
    fi
  done

  echo "✅ Documentation validation passed"
fi
```

### Documentation Linting Script

**File:** `scripts/docs-lint.sh`

```bash
#!/bin/bash
# Lint all documentation for common issues

set -e

echo "=== Documentation Linting ==="

ISSUES=0

# Check 1: Verify all docs have frontmatter
echo "Checking for frontmatter..."
find docs -name "*.md" -type f | while read -r file; do
  if ! head -n 1 "$file" | grep -q "^---$"; then
    echo "⚠️  Missing frontmatter: $file"
    ISSUES=$((ISSUES + 1))
  fi
done

# Check 2: Verify naming convention (kebab-case)
echo "Checking naming conventions..."
find docs plans -name "*.md" -type f | while read -r file; do
  basename=$(basename "$file")
  if [[ ! "$basename" =~ ^[a-z0-9-]+\.md$ ]] && [[ "$basename" != "README.md" ]]; then
    echo "⚠️  Non-kebab-case name: $file"
    ISSUES=$((ISSUES + 1))
  fi
done

# Check 3: Detect orphaned files (not linked anywhere)
echo "Checking for orphaned files..."
find docs -name "*.md" -type f ! -name "README.md" | while read -r file; do
  filename=$(basename "$file")

  # Search for references
  if ! grep -rq "$filename" docs/ plans/ README.md 2>/dev/null; then
    echo "⚠️  Orphaned (not linked): $file"
    ISSUES=$((ISSUES + 1))
  fi
done

# Check 4: Validate links
bash scripts/docs-migration/11-validate-links.sh || ISSUES=$((ISSUES + 1))

if [[ $ISSUES -eq 0 ]]; then
  echo "✅ All checks passed"
  exit 0
else
  echo "⚠️  Found $ISSUES issues"
  exit 1
fi
```

### Documentation Stats Script

**File:** `scripts/docs-stats.sh`

```bash
#!/bin/bash
# Generate documentation statistics

echo "=== Documentation Statistics ==="

echo ""
echo "📊 File Counts:"
echo "  Core Docs:      $(find docs/core -name "*.md" | wc -l)"
echo "  Guides:         $(find docs/guides -name "*.md" 2>/dev/null | wc -l)"
echo "  Features:       $(find docs/features -name "*.md" | wc -l)"
echo "  Migrations:     $(find docs/migrations -name "*.md" ! -name "README.md" | wc -l)"
echo "  Historical:     $(find docs/historical -name "*.md" ! -name "README.md" | wc -l)"

echo ""
echo "📝 Total Lines:"
find docs -name "*.md" -exec wc -l {} + | tail -n 1

echo ""
echo "🔗 Link Count:"
grep -r "\[.*\](.*\.md)" docs/ | wc -l

echo ""
echo "📅 Recently Updated (last 7 days):"
find docs -name "*.md" -mtime -7 -exec ls -l {} \; | wc -l

echo ""
echo "✅ Stats generated"
```

## Documentation Review Process

### Weekly Review Checklist

**Run every Monday:**

1. **Check for outdated docs:**
   ```bash
   find docs -name "*.md" -mtime +90  # Not updated in 90 days
   ```

2. **Review open TODOs:**
   ```bash
   grep -r "TODO" docs/ plans/
   ```

3. **Validate all links:**
   ```bash
   bash scripts/docs-migration/11-validate-links.sh
   ```

4. **Generate stats:**
   ```bash
   bash scripts/docs-stats.sh
   ```

5. **Update README navigation** if needed

### Monthly Audit Tasks

**Run first week of each month:**

1. **Archive completed phase docs**
   - Move to `completion/` folder
   - Update plan.md status

2. **Review historical docs**
   - Delete if no longer relevant
   - Update if insights still valuable

3. **Update codebase-summary.md**
   - Reflect current project structure
   - Update file counts, key modules

4. **Sync code-standards.md**
   - Ensure rules match actual practice
   - Add new patterns discovered

5. **Review project-roadmap.md**
   - Update phase statuses
   - Adjust timeline if needed

## Documentation Quality Standards

### Writing Style

**DO:**
- Use active voice
- Be concise and specific
- Include code examples
- Use consistent terminology
- Add diagrams for complex concepts

**DON'T:**
- Use jargon without explanation
- Write walls of text
- Assume prior knowledge
- Leave TODO placeholders long-term
- Duplicate content across docs

### Structure Guidelines

**Every doc should have:**
1. **Clear title** (H1)
2. **Status/metadata** (frontmatter)
3. **Overview** (what/why)
4. **Content sections** (how)
5. **Related links** (see also)

**Recommended sections:**
- Overview
- Prerequisites
- Step-by-step instructions
- Examples
- Troubleshooting
- Related documentation

### Code Example Standards

```markdown
## Usage Example

**Context:** When to use this feature

\`\`\`typescript
// Good: Include type annotations
interface Config {
  feature: string;
  enabled: boolean;
}

// Show realistic example
const config: Config = {
  feature: 'fast-lane',
  enabled: true
};
\`\`\`

**Expected output:**
\`\`\`
✅ Feature enabled: fast-lane
\`\`\`
```

## Git Workflow Integration

### Branch Naming for Docs

```bash
# Documentation updates
docs/update-architecture
docs/add-deployment-guide

# Documentation fixes
docs/fix-broken-links
docs/fix-typos-in-api-contracts
```

### Commit Message Format

```bash
# Updates
docs: Update system architecture with queue details

# New docs
docs: Add deployment guide for production

# Fixes
docs: Fix broken links in README

# Refactoring
docs: Reorganize feature documentation structure
```

### Pull Request Template

**For documentation PRs:**

```markdown
## Documentation Changes

**Type:** [New Doc|Update|Fix|Refactor]

**Files changed:**
- docs/core/system-architecture.md
- docs/features/fast-lane-processing.md

**Changes made:**
- Updated architecture diagrams
- Added queue implementation details
- Fixed broken links

**Validation:**
- [ ] Links validated
- [ ] Spelling checked
- [ ] Follows naming convention
- [ ] Added to navigation
- [ ] Metadata updated
```

## Automation Opportunities

### GitHub Actions Workflow

**File:** `.github/workflows/docs-validation.yml`

```yaml
name: Validate Documentation

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'plans/**'
      - 'README.md'
      - 'CLAUDE.md'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check for broken links
        run: bash scripts/docs-migration/11-validate-links.sh

      - name: Lint documentation
        run: bash scripts/docs-lint.sh

      - name: Check for TODOs
        run: |
          if grep -r "TODO" docs/; then
            echo "⚠️ TODOs found in documentation"
            exit 1
          fi
```

### Documentation Generation

**Auto-generate codebase-summary.md:**

```bash
#!/bin/bash
# scripts/generate-codebase-summary.sh

cat > docs/core/codebase-summary.md <<EOF
# Codebase Summary

**Last updated:** $(date +%Y-%m-%d)
**Auto-generated** - Do not edit manually

## Project Structure

\`\`\`
$(tree -L 2 -I 'node_modules|.git')
\`\`\`

## File Counts

- TypeScript: $(find . -name "*.ts" ! -path "*/node_modules/*" | wc -l)
- Test files: $(find . -name "*.test.ts" | wc -l)
- Documentation: $(find docs -name "*.md" | wc -l)

## Key Modules

$(find apps/backend/src -type d -maxdepth 1 | tail -n +2 | sed 's|^|- |')

EOF
```

## Training & Onboarding

### New Developer Checklist

**Documentation reading order:**

1. ✅ [README.md](../../README.md) - Quick start
2. ✅ [Project Overview](docs/core/project-overview-pdr.md) - Context
3. ✅ [System Architecture](docs/core/system-architecture.md) - How it works
4. ✅ [Code Standards](docs/core/code-standards.md) - Coding rules
5. ✅ [Testing Strategy](docs/core/testing-strategy.md) - TDD approach
6. ✅ [Development Workflow](docs/guides/development-workflow.md) - Daily process

### Documentation Contribution Guide

**File:** `docs/CONTRIBUTING.md`

```markdown
# Contributing to Documentation

## Quick Start

1. Choose appropriate directory for your doc
2. Use template from `docs/templates/`
3. Follow naming convention (kebab-case)
4. Add frontmatter metadata
5. Update navigation README
6. Validate links before committing

## Need Help?

- [Documentation Standards](core/code-standards.md#documentation)
- [Writing Style Guide](guides/writing-style-guide.md)
- Ask in #documentation channel
```

## Success Criteria

- [ ] Pre-commit hook installed
- [ ] Documentation linting script created
- [ ] Stats generation script created
- [ ] Weekly review checklist documented
- [ ] Git workflow integrated
- [ ] GitHub Actions validation configured
- [ ] Auto-generation scripts created
- [ ] CONTRIBUTING.md created

## Maintenance Schedule

### Daily
- Automated link validation on PRs

### Weekly
- Review outdated docs (>90 days)
- Check open TODOs
- Generate stats

### Monthly
- Archive completed phases
- Clean historical docs
- Update roadmap
- Sync code standards

### Quarterly
- Full documentation audit
- Update templates
- Review and improve processes

## Next Steps After Phase 06

1. **Monitor adoption** - Track if team follows new structure
2. **Gather feedback** - Adjust processes based on usage
3. **Iterate** - Refine templates and automation
4. **Expand** - Add more guides as project grows
