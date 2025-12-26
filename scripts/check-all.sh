#!/bin/bash

# Function to run a command and only print pass/fail
run_check_suite() {
    local name="$1"
    local cmd="$2"
    local log_file="/tmp/check_run_$(date +%s).log"
    
    echo -n "Running $name... "
    
    # Run command and redirect output to a log file
    if eval "$cmd" > "$log_file" 2>&1; then
        echo "✅ PASSED"
        rm "$log_file"
    else
        echo "❌ FAILED"
        echo "Details:"
        tail -n 20 "$log_file"
        echo "..."
        echo "Full log: $log_file"
        return 1
    fi
}

echo "🔍 Starting all code checks..."
echo "--------------------------------"

# 1. Type Checks (TypeScript)
run_check_suite "Type Checks (TypeScript)" "pnpm turbo run type-check" || exit 1

# 2. Lint Checks (ESLint)
run_check_suite "Lint Checks (ESLint)" "pnpm turbo run lint" || exit 1

# 3. Python Lint Checks (Ruff)
run_check_suite "Python Lint Checks (Ruff)" "cd apps/ai-worker && . .venv/bin/activate && ruff check ." || exit 1

echo "--------------------------------"
echo "✨ All checks passed successfully!"
