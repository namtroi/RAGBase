#!/bin/bash
# Removes generated artifacts that can be recreated

set -e

echo "=== Cleaning Up Generated Artifacts ==="

ARTIFACTS=(
  "repomix-output.xml"
)

for file in "${ARTIFACTS[@]}"; do
  if [[ -f "$file" ]]; then
    echo "Removing: $file (can regenerate with 'repomix')"
    rm -f "$file"
  fi
done

echo "✅ Artifacts cleaned up"
echo ""
echo "⚠️  Note: Historical docs ARCHIVED, not deleted"
echo "   - Phase completions: plans/.../completion/"
echo "   - Old reviews: plans/reports/archive/"
echo "   - Debug notes: docs/historical/"
