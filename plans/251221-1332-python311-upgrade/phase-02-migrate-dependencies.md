# Phase 02: Migrate Dependencies

**Parent:** [plan.md](./plan.md) | **Status:** Not Started | **Priority:** P1

## Objective

Create Python 3.11 venv, install all deps from requirements files.

## Related Files

- `apps/ai-worker/requirements.txt`
- `apps/ai-worker/requirements-prod.txt`
- `apps/ai-worker/requirements-dev.txt`

## Implementation Steps

1. **Navigate to ai-worker:**
   ```bash
   cd /home/namtroi/RAGBase/apps/ai-worker
   ```

2. **Create Python 3.11 venv:**
   ```bash
   python3.11 -m venv .venv
   ```

3. **Activate venv:**
   ```bash
   source .venv/bin/activate
   ```

4. **Verify Python version in venv:**
   ```bash
   python --version  # Should show 3.11.x (NOT 3.10)
   which python      # Should show .venv/bin/python
   ```

5. **Upgrade pip:**
   ```bash
   pip install --upgrade pip setuptools wheel
   ```

6. **Install production deps:**
   ```bash
   pip install -r requirements-prod.txt
   ```

7. **Install dev deps:**
   ```bash
   pip install -r requirements-dev.txt
   ```

8. **Freeze installed versions:**
   ```bash
   pip freeze > /tmp/installed-311.txt
   ```

## Success Criteria

- [x] Venv created at `apps/ai-worker/.venv`
- [x] Python in venv is 3.11.x
- [x] All deps install without errors
- [x] `pip list` shows docling, bullmq, pymupdf, fastapi

## Known Issues

- **bullmq version mismatch:** requirements-prod.txt has 2.18.1 but 0.5.6 needed (fix in Phase 03)
- **pygobject warning:** pycairo missing (non-blocking, can ignore)

## Next Steps

→ Phase 03: Fix dependency conflicts
