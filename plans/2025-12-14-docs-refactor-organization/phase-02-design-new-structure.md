# Phase 02: Design New Documentation Structure

**Priority:** High
**Status:** Ready to implement
**Estimated Complexity:** Medium

## Overview

Define standardized structure, naming conventions, templates, and navigation strategy for all documentation.

## Target Directory Structure

```
D:\14-osp\SchemaForge/
├── README.md                          # Quick start, nav hub
├── CLAUDE.md                          # AI assistant rules
├── docs/
│   ├── README.md                      # Docs navigation index
│   │
│   ├── core/                          # Essential reading
│   │   ├── project-overview-pdr.md   # What, why, goals
│   │   ├── system-architecture.md    # How it works
│   │   ├── api-contracts.md          # API specs
│   │   ├── project-roadmap.md        # Phases, timeline
│   │   ├── testing-strategy.md       # TDD approach
│   │   ├── code-standards.md         # Coding rules
│   │   └── codebase-summary.md       # Structure overview
│   │
│   ├── guides/                        # How-to documentation
│   │   ├── quick-start.md            # Get running in 5 min
│   │   ├── development-workflow.md   # Daily dev process
│   │   ├── deployment-guide.md       # Production deploy
│   │   └── troubleshooting.md        # Common issues
│   │
│   ├── features/                      # Feature-specific docs
│   │   ├── fast-lane-processing.md
│   │   ├── fast-lane-quick-reference.md
│   │   ├── vector-search.md
│   │   └── ocr-support.md
│   │
│   ├── migrations/                    # Technical migrations
│   │   ├── fastembed-migration.md
│   │   └── README.md                 # Migration index
│   │
│   ├── historical/                    # Resolved issues, notes
│   │   ├── embedding-test-issue.md
│   │   ├── typescript-path-fix.md
│   │   └── README.md                 # What's here and why
│   │
│   └── templates/                     # Doc templates
│       ├── feature-doc-template.md
│       ├── migration-doc-template.md
│       └── phase-completion-template.md
│
├── plans/
│   ├── README.md                      # Plans navigation
│   │
│   ├── 2025-12-13-phase1-tdd-implementation/
│   │   ├── plan.md                   # Overview
│   │   ├── phase-00-scaffold-infrastructure.md
│   │   ├── phase-01-test-infrastructure.md
│   │   ├── ...
│   │   ├── completion/               # Phase artifacts
│   │   │   ├── phase-00-complete.md
│   │   │   ├── phase-01-complete.md
│   │   │   └── ...
│   │   ├── research/
│   │   ├── reports/
│   │   └── scout/
│   │
│   ├── 2025-12-14-docs-refactor-organization/
│   │   └── (this plan)
│   │
│   ├── reports/                       # Active reports
│   │   ├── code-reviewer-*.md
│   │   ├── project-manager-*.md
│   │   └── archive/                  # Old reports
│   │       └── 2024-*.md
│   │
│   └── templates/                     # Plan templates
│       ├── phase-template.md
│       └── plan-template.md
```

## Naming Conventions

### Core Documentation
**Pattern:** `{topic}-{type}.md`
**Examples:**
- project-overview-pdr.md
- system-architecture.md
- api-contracts.md

**Rules:**
- Use kebab-case
- Be descriptive (self-documenting)
- Avoid abbreviations unless standard (API, PDR)

### Implementation Guides
**Pattern:** `{feature-name}.md` or `{feature-name}-guide.md`
**Examples:**
- fast-lane-processing.md
- vector-search-guide.md

### Migration Documentation
**Pattern:** `{from}-to-{to}-migration.md` or `{technology}-migration.md`
**Examples:**
- fastembed-migration.md
- xenova-to-fastembed-migration.md

### Historical Notes
**Pattern:** `{issue-type}-{brief-description}.md`
**Examples:**
- embedding-test-issue.md
- typescript-path-fix.md

### Phase Completion Docs
**Pattern:** `phase-{XX}-complete.md`
**Examples:**
- phase-00-complete.md
- phase-06-complete.md

### Code Review Reports
**Pattern:** `code-reviewer-{date}-{scope}.md`
**Examples:**
- code-reviewer-2025-12-14-fast-lane.md
- code-reviewer-2025-12-13-phase04-fixes.md

## Documentation Templates

### Feature Documentation Template
```markdown
# {Feature Name}

**Status:** {Implemented|Planned|Deprecated}
**Version:** {version}
**Phase:** {phase number}

## Overview
Brief description (2-3 sentences)

## Key Concepts
- Concept 1
- Concept 2

## Architecture
How it works (diagrams welcome)

## Usage
Code examples

## Configuration
Environment variables, settings

## Testing
How to test this feature

## Troubleshooting
Common issues and solutions

## Related Documentation
- [Link to related docs]
```

### Migration Documentation Template
```markdown
# {Technology} Migration

**Date:** {YYYY-MM-DD}
**From:** {old technology}
**To:** {new technology}
**Reason:** {why migrate}
**Status:** {Complete|In Progress}

## Context
Why we migrated

## Changes Made
Detailed list of changes

## Breaking Changes
What broke and how to fix

## Rollback Plan
How to revert if needed

## Performance Impact
Before/after metrics

## Lessons Learned
What went well, what didn't
```

## Navigation Strategy

### README.md Hub Structure
```markdown
# SchemaForge

Quick intro

## Quick Links
- [Getting Started](docs/guides/quick-start.md)
- [Architecture](docs/core/system-architecture.md)
- [API Docs](docs/core/api-contracts.md)

## Documentation
- [Core Docs](docs/core/) - Essential reading
- [Guides](docs/guides/) - How-to guides
- [Features](docs/features/) - Feature documentation
- [Plans](plans/) - Implementation plans

## Development
- [Code Standards](docs/core/code-standards.md)
- [Testing Strategy](docs/core/testing-strategy.md)
- [Roadmap](docs/core/project-roadmap.md)
```

### docs/README.md Navigation Index
```markdown
# Documentation Index

## Getting Started
1. [Quick Start](guides/quick-start.md)
2. [Project Overview](core/project-overview-pdr.md)
3. [System Architecture](core/system-architecture.md)

## Core Documentation
Essential reading for all developers
- [Project Overview PDR](core/project-overview-pdr.md)
- [System Architecture](core/system-architecture.md)
- [API Contracts](core/api-contracts.md)
- [Testing Strategy](core/testing-strategy.md)
- [Code Standards](core/code-standards.md)
- [Project Roadmap](core/project-roadmap.md)

## Guides
- [Development Workflow](guides/development-workflow.md)
- [Deployment Guide](guides/deployment-guide.md)
- [Troubleshooting](guides/troubleshooting.md)

## Features
- [Fast Lane Processing](features/fast-lane-processing.md)
- [Vector Search](features/vector-search.md)

## Historical Reference
- [Migrations](migrations/)
- [Resolved Issues](historical/)
```

## File Metadata Standard

Add YAML frontmatter to all docs:

```yaml
---
title: Fast Lane Processing
status: Implemented
phase: 06
last_updated: 2025-12-14
related:
  - docs/core/system-architecture.md
  - docs/core/api-contracts.md
tags:
  - processing
  - performance
  - fastlane
---
```

## Link Reference Format

**Use relative paths:**
- From root: `docs/core/system-architecture.md`
- From docs/: `core/system-architecture.md`
- From docs/guides/: `../core/system-architecture.md`

**Never use:**
- Absolute paths: ❌ `/docs/core/...`
- Full URLs: ❌ `https://github.com/...`

## Implementation Steps

### Step 1: Create New Directory Structure
```bash
mkdir -p docs/{core,guides,features,migrations,historical,templates}
```

### Step 2: Create README Navigation Files
- docs/README.md
- plans/README.md

### Step 3: Create Templates
- docs/templates/feature-doc-template.md
- docs/templates/migration-doc-template.md
- docs/templates/phase-completion-template.md

### Step 4: Add Frontmatter to Existing Core Docs
Update ARCHITECTURE.md, CONTRACT.md, etc. with metadata

### Step 5: Validate Structure
Ensure all directories exist and are documented

## Success Criteria

- [ ] Directory structure created
- [ ] Navigation READMEs written
- [ ] Templates created
- [ ] Naming conventions documented
- [ ] Link reference format defined
- [ ] Metadata standard established

## Next Phase

**Phase 03:** Create Migration Scripts (automate the file moves)
