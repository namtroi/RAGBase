# Contributing to Documentation

## Quick Start

1. Choose appropriate directory for your doc
2. Follow naming convention (kebab-case)
3. Update navigation README
4. Link to related documents

## Directory Structure

```
docs/
├── core/          # Essential project documentation
├── guides/        # How-to tutorials (future)
├── features/      # Feature-specific documentation
├── migrations/    # Technical migration records
├── historical/    # Resolved issues, debugging notes
└── templates/     # Documentation templates
```

## Naming Convention

**Pattern:** `{topic}-{type}.md`

**Rules:**
- Use kebab-case (lowercase with hyphens)
- Be descriptive and self-documenting
- Avoid abbreviations unless standard (API, PDF)

**Examples:**
- `fast-lane-processing.md`
- `system-architecture.md`
- `fastembed-migration.md`

## File Organization

### Core Documentation (docs/core/)
Essential reading for all developers:
- Project overview, architecture, contracts
- Testing strategy, code standards
- Project roadmap, codebase summary

### Feature Documentation (docs/features/)
Feature-specific guides:
- Implementation details
- Configuration options
- Usage examples

### Migration Documentation (docs/migrations/)
Technical migration records:
- Migration context and rationale
- Changes made
- Breaking changes and fixes

### Historical Notes (docs/historical/)
Resolved issues and debugging notes:
- Problem-solving insights
- Technical debt evolution
- Lessons learned

## Documentation Standards

### File Structure
Every doc should have:
1. Clear H1 title
2. Status/context section
3. Overview (what/why)
4. Content sections (how)
5. Related links

### Writing Style
- **Use active voice**
- **Be concise and specific**
- **Include code examples**
- **Use consistent terminology**
- **Add diagrams for complex concepts**

### Link Format
**Use relative paths:**
- From root: `docs/core/system-architecture.md`
- From docs/: `core/system-architecture.md`
- From docs/guides/: `../core/system-architecture.md`

**Never use:**
- Absolute paths: ❌ `/docs/core/...`
- Full URLs: ❌ `https://github.com/...`

## Updating Documentation

### When creating new documentation:

1. **Identify category** - Where does it belong?
2. **Create file** - Follow naming convention
3. **Add content** - Use appropriate structure
4. **Update navigation** - Add to relevant README
5. **Link related docs** - Cross-reference

### When updating existing documentation:

1. **Make changes** - Update content
2. **Check links** - Ensure no broken links
3. **Update metadata** - Last updated date
4. **Commit** - Use conventional commit format

## Commit Message Format

```bash
# New docs
docs: Add deployment guide for production

# Updates
docs: Update system architecture with queue details

# Fixes
docs: Fix broken links in README

# Refactoring
docs: Reorganize feature documentation structure
```

## Quality Checklist

Before committing documentation:

- [ ] File in correct directory
- [ ] Follows naming convention (kebab-case)
- [ ] Navigation README updated
- [ ] No broken internal links
- [ ] Code examples work
- [ ] Spelling checked
- [ ] Clear and concise

## Need Help?

- Check existing docs for examples
- Review [Code Standards](core/code-standards.md)
- Ask in team channels
