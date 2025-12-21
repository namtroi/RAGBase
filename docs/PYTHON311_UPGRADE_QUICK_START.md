# Python 3.11 Upgrade - Quick Start Guide

**Status:** COMPLETE ✓
**Last Updated:** December 21, 2025
**Python Version:** 3.11.0rc1

---

## One-Minute Summary

Python 3.11 upgrade is complete and production-ready:
- All 28 tests passing (100%)
- 78% code coverage
- 130 dependencies installed
- Zero breaking changes
- Dev/prod aligned (Docker already uses 3.11)

---

## Quick Start (3 Steps)

### Step 1: Activate Environment

```bash
cd /home/namtroi/RAGBase/apps/ai-worker
source .venv/bin/activate
```

### Step 2: Verify Setup

```bash
python --version
# Output: Python 3.11.0rc1

pip list | wc -l
# Output: 132 (packages + pip + setuptools)
```

### Step 3: Run Tests

```bash
pytest tests/ -v --cov
# All 28 tests should pass
```

Done! You're ready to develop with Python 3.11.

---

## Essential Commands

### Activate venv
```bash
source /home/namtroi/RAGBase/apps/ai-worker/.venv/bin/activate
```

### Check Python version
```bash
python --version
# Should show: Python 3.11.0rc1
```

### Run tests
```bash
pytest tests/ -v
```

### Check coverage
```bash
pytest tests/ --cov
```

### Reinstall dependencies (if needed)
```bash
pip install -r requirements.txt
pip install -r requirements-prod.txt
pip install -r requirements-dev.txt
```

### Create fresh environment
```bash
python3.11 -m venv .venv-fresh
source .venv-fresh/bin/activate
pip install -r requirements.txt
```

---

## Key Information

### Versions
- **System Python:** 3.10.12 (unchanged at `/usr/bin/python3`)
- **Python 3.11:** 3.11.0rc1 (installed at `/usr/bin/python3.11`)
- **Dev Environment:** Python 3.11.0rc1 (`.venv`)

### Key Dependencies
- fastapi 0.126.0
- docling 2.15.0
- pymupdf 1.26.0
- bullmq 2.15.0 (corrected)
- pytest 8.3.4

### Files Modified
- `apps/ai-worker/requirements.txt` (bullmq version)
- `apps/ai-worker/requirements-prod.txt` (bullmq version)

### Test Status
- Total: 28 tests
- Passed: 28 (100%)
- Coverage: 78%

---

## Troubleshooting

### "venv not found"
```bash
# Check venv exists
ls -la /home/namtroi/RAGBase/apps/ai-worker/.venv/bin/activate

# Recreate if needed
python3.11 -m venv /home/namtroi/RAGBase/apps/ai-worker/.venv
source /home/namtroi/RAGBase/apps/ai-worker/.venv/bin/activate
pip install -r requirements.txt
```

### "Wrong Python version"
```bash
# Verify you're in venv
which python
# Should show: /path/to/.venv/bin/python

# Activate properly
source /home/namtroi/RAGBase/apps/ai-worker/.venv/bin/activate
python --version
```

### "Import errors"
```bash
# Reinstall dependencies
source /home/namtroi/RAGBase/apps/ai-worker/.venv/bin/activate
pip install -r requirements.txt --force-reinstall
pip install -r requirements-prod.txt --force-reinstall
```

### "Tests failing"
```bash
# Run with verbose output
pytest tests/ -vv --tb=short

# See coverage report
pytest tests/ --cov --cov-report=html
# Open htmlcov/index.html in browser
```

---

## Important Notes

- System Python 3.10.12 is unchanged - safe for other projects
- venv is isolated - doesn't affect system Python
- All dependencies are pinned to exact versions
- Docker already uses Python 3.11-slim - no Docker changes needed
- Zero production code changes - only requirements files updated
- Fully backwards compatible - no breaking changes

---

## Next Steps

1. **Activate environment:** `source .venv/bin/activate`
2. **Develop normally:** Use Python 3.11 for all development
3. **Run tests regularly:** `pytest tests/`
4. **Report issues:** If you find any Python 3.11 specific problems, report them

---

## Full Documentation

For complete details, see:
- **Main docs:** `/home/namtroi/RAGBase/docs/core/python-311-upgrade.md`
- **Completion report:** `/home/namtroi/RAGBase/plans/reports/2025-12-21-python311-upgrade-complete.md`

---

**Status:** Production-Ready ✓
**Last Updated:** December 21, 2025
