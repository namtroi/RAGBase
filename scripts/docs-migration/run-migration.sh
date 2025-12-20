#!/bin/bash
# Master script to run all migration steps

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   RAGBase Documentation Migration        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Run all steps in order
for script in "$SCRIPT_DIR"/{01..09}-*.sh; do
  if [[ -f "$script" ]]; then
    echo ""
    echo "▶ Running: $(basename "$script")"
    bash "$script"
  fi
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Migration Complete!                        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Review changes: git status"
echo "2. Update documentation links (will be done automatically)"
echo "3. Commit changes: git commit -m 'docs: Refactor documentation structure'"
