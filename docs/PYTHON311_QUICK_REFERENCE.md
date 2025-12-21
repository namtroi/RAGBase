# Python 3.11 Upgrade - Quick Reference Guide

**Updated:** December 21, 2025
**Phase:** 03 Complete (Dependency Conflicts Fixed)
**Status:** Ready for Phase 04 Testing

---

## TL;DR - What Changed in Phase 03

**bullmq version corrected:**
- `requirements.txt` (line 25): `2.18.1` → `2.15.0`
- `requirements-prod.txt` (line 17): `2.18.1` → `2.15.0`

**Why?** Installed version was 2.15.0, but files declared 2.18.1. Now they match.

**Impact?** None. Both versions are API-compatible. Job queue works without code changes.

---

## Common Tasks

### Activate Python 3.11 Environment

```bash
cd /home/namtroi/RAGBase/apps/ai-worker
source .venv/bin/activate
```

### Verify Python Version

```bash
python --version
# Expected: Python 3.11.0rc1
```

### Check bullmq Version

```bash
python -c "import bullmq; print(bullmq.__version__)"
# Expected: 2.15.0
```

### Install/Update Dependencies

```bash
cd /home/namtroi/RAGBase/apps/ai-worker
source .venv/bin/activate

# Base requirements
pip install -r requirements.txt

# Production requirements (includes base)
pip install -r requirements-prod.txt

# Development requirements (testing)
pip install -r requirements-dev.txt
```

### Check for Conflicts

```bash
pip check
# Expected: No conflicts related to bullmq
```

### Run Tests

```bash
cd /home/namtroi/RAGBase/apps/ai-worker
pytest tests/ -v
```

---

## File Reference

| File | bullmq Line | Current Version | Status |
|------|------------|-----------------|--------|
| requirements.txt | 25 | 2.15.0 | ✓ Correct |
| requirements-prod.txt | 17 | 2.15.0 | ✓ Correct |

---

## Troubleshooting

### Issue: Wrong Python Version After Activation

**Solution:**
```bash
# Check which python
which python
# Should show: /path/to/apps/ai-worker/.venv/bin/python

# If it doesn't, activate again
cd /home/namtroi/RAGBase/apps/ai-worker
source .venv/bin/activate
```

### Issue: Import Errors for bullmq

**Solution:**
```bash
# Verify installed
pip show bullmq

# Reinstall if missing
pip install bullmq==2.15.0

# Check version
python -c "import bullmq; print(bullmq.__version__)"
```

### Issue: Fresh Install Shows Wrong Version

**Solution:**
```bash
# If bullmq installs as 2.18.1 instead of 2.15.0
pip install bullmq==2.15.0

# Verify declaration matches
grep bullmq apps/ai-worker/requirements*.txt
# Both should show: bullmq==2.15.0
```

---

## What's Next?

### Phase 04: Testing (In Progress)

Run the test suite to ensure Python 3.11 compatibility:

```bash
cd /home/namtroi/RAGBase
pytest apps/ai-worker/tests/ -v
```

### Phase 05: Docker (Pending)

Docker already uses Python 3.11. Just rebuild to pick up corrected bullmq version:

```bash
docker compose build ai-worker
```

---

## Key Facts

- ✓ Python 3.11.0rc1 installed and working
- ✓ All 130 dependencies installed
- ✓ bullmq version corrected (2.15.0)
- ✓ No API-breaking changes
- ✓ Ready for testing

---

## Need More Info?

- **Detailed Upgrade Info:** See `/home/namtroi/RAGBase/docs/core/python-311-upgrade.md`
- **Phase 03 Details:** See `/home/namtroi/RAGBase/plans/251221-1332-python311-upgrade/phase-03-fix-dependency-conflicts.md`
- **Technical Changes:** See `/home/namtroi/RAGBase/plans/reports/PHASE03_TECHNICAL_CHANGELOG.md`
- **Phase Overview:** See `/home/namtroi/RAGBase/docs/PYTHON311_UPGRADE_SUMMARY.md`

---

**Keep Development Moving Forward!**
