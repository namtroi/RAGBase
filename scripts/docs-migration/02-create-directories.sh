#!/bin/bash
# Creates new directory structure

set -e

echo "=== Creating Documentation Directory Structure ==="

# Create all target directories
mkdir -p docs/core
mkdir -p docs/guides
mkdir -p docs/features
mkdir -p docs/migrations
mkdir -p docs/historical
mkdir -p docs/templates
mkdir -p plans/2025-12-13-phase1-tdd-implementation/completion
mkdir -p plans/reports/archive

echo "✅ Directories created"

# Verify creation
for dir in docs/{core,guides,features,migrations,historical,templates}; do
  if [[ -d "$dir" ]]; then
    echo "✅ $dir"
  else
    echo "❌ Failed to create $dir"
    exit 1
  fi
done
