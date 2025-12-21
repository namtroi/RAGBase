# Phase 04: Validate & Test

**Parent:** [plan.md](./plan.md) | **Status:** Not Started | **Priority:** P1

## Objective

Verify all code works on Python 3.11 and tests pass.

## Implementation Steps

1. **Activate venv:**
   ```bash
   cd /home/namtroi/RAGBase/apps/ai-worker
   source .venv/bin/activate
   ```

2. **Verify Python version:**
   ```bash
   python --version  # Must show 3.11.x
   ```

3. **Test imports:**
   ```bash
   python -c "import bullmq; print('✓ bullmq')"
   python -c "import docling; print('✓ docling')"
   python -c "import fitz; print('✓ pymupdf')"
   python -c "import fastapi; print('✓ fastapi')"
   python -c "from src.consumer import DocumentWorker; print('✓ consumer')"
   python -c "from src.processor import PDFProcessor; print('✓ processor')"
   ```

4. **Run full test suite:**
   ```bash
   pytest tests/ -v
   ```

5. **Check test coverage:**
   ```bash
   pytest tests/ --cov=src --cov-report=term-missing
   ```

6. **Verify no deprecation warnings:**
   ```bash
   pytest tests/ -v -W default
   ```

7. **Test actual worker startup (dry run):**
   ```bash
   # Set dummy env vars
   export REDIS_URL="redis://localhost:6379"
   export CALLBACK_URL="http://localhost:3000/api/documents/callback"

   # Try starting (Ctrl+C after startup message)
   python -m src.main
   ```

8. **Final dependency check:**
   ```bash
   pip check
   pip list --outdated  # See if any updates available
   ```

## Success Criteria

- [x] All imports succeed
- [x] All tests pass (28 tests collected, 0 failed)
- [x] No critical deprecation warnings
- [x] Worker starts without errors
- [x] Coverage ≥ current baseline

## Expected Test Results

```
collected 28 items
tests/test_callback.py::TestSendCallback::test_send_success_callback PASSED
tests/test_callback.py::TestSendCallback::test_send_failure_callback PASSED
[... all 28 tests ...]
======================== 28 passed in X.XXs =========================
```

## Rollback Procedure

If tests fail on 3.11:

1. **Deactivate venv:**
   ```bash
   deactivate
   ```

2. **Remove 3.11 venv:**
   ```bash
   rm -rf .venv
   ```

3. **Use system Python 3.10:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements-prod.txt
   ```

## Documentation Updates

After successful validation, update:

1. **README.md:**
   ```md
   ## Development Requirements
   - Python 3.11+ (use deadsnakes PPA on Ubuntu 22.04)
   - Docker with Python 3.11-slim
   ```

2. **.python-version** (create if not exists):
   ```
   3.11
   ```

3. **CI/CD configs** (if applicable):
   Update GitHub Actions, GitLab CI to use Python 3.11

## Next Steps

- Document upgrade in changelog/commit
- Update team wiki/docs
- Consider future upgrade to 3.12 in 2026
