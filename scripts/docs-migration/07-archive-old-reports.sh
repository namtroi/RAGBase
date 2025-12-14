#!/bin/bash
# Archives old code review reports

set -e

echo "=== Archiving Old Reports ==="

DEST="plans/reports/archive"

# Move old reports from root
declare -a ROOT_REPORTS=(
  "CODE_REVIEW_SUMMARY.md"
  "FIX_RECOMMENDATIONS.md"
)

for file in "${ROOT_REPORTS[@]}"; do
  if [[ -f "$file" ]]; then
    echo "Archiving: $file → $DEST/$file"
    git mv "$file" "$DEST/$file"
  fi
done

# Check for REVIEW_COMPLETE.txt
if [[ -f "REVIEW_COMPLETE.txt" ]]; then
  echo "Archiving: REVIEW_COMPLETE.txt → $DEST/REVIEW_COMPLETE.txt"
  git mv "REVIEW_COMPLETE.txt" "$DEST/REVIEW_COMPLETE.txt"
fi

echo "✅ Old reports archived"
