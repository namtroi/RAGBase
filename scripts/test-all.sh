#!/bin/bash

# Function to run a command and only print pass/fail
run_test_suite() {
    local name="$1"
    local cmd="$2"
    local log_file="/tmp/test_run_$(date +%s).log"
    
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

echo "🚀 Starting all test suites..."
echo "--------------------------------"

# 1. Backend Unit Tests
run_test_suite "Backend Unit Tests" "pnpm turbo run test:unit" || exit 1

# 2. Backend Integration Tests
run_test_suite "Backend Integration Tests" "pnpm turbo run test:integration" || exit 1

# 3. Backend E2E Tests
run_test_suite "Backend E2E Tests" "pnpm --filter @ragbase/backend test:e2e" || exit 1

# 4. AI Worker Tests
run_test_suite "AI Worker Tests" "cd apps/ai-worker && . .venv/bin/activate && pytest" || exit 1

echo "--------------------------------"
echo "🎉 All tests passed successfully!"
