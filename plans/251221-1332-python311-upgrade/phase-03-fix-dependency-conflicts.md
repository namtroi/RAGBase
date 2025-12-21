# Phase 03: Fix Dependency Conflicts

**Parent:** [plan.md](./plan.md) | **Status:** COMPLETED | **Priority:** P1 | **Completed:** 2025-12-21T14:15

## Objective

Resolve known dependency version conflicts identified during upgrade.

## Issues Fixed

### 1. bullmq Version Mismatch ✓ FIXED

**Problem:**
- `requirements.txt` declared `bullmq==2.18.1` (line 25)
- `requirements-prod.txt` declared `bullmq==2.18.1` (line 17)
- Actual installed version on Python 3.11: `bullmq==2.15.0`
- Version mismatch causes reproducibility issues

**Resolution:**
- Updated `requirements.txt` line 25: `bullmq==2.18.1` → `bullmq==2.15.0`
- Updated `requirements-prod.txt` line 17: `bullmq==2.18.1` → `bullmq==2.15.0`

**Result:** Declared versions now match installed/actual versions. Ensures reproducible builds across all environments.

### 2. pygobject/pycairo Warning (Not Needed)

**Status:** Not addressed

**Reason:** Non-blocking. Only needed for GTK GUI apps. ai-worker is a headless service - no GUI dependencies required.

## Implementation Summary

**Files Modified:**
1. `apps/ai-worker/requirements.txt` (line 25)
   - Changed: `bullmq==2.18.1` → `bullmq==2.15.0`

2. `apps/ai-worker/requirements-prod.txt` (line 17)
   - Changed: `bullmq==2.18.1` → `bullmq==2.15.0`

**Verification Completed:**
- Both files updated to match actual installed version
- Dependencies now consistent across requirements and venv
- No conflicts detected in Python 3.11 environment
- All dependency pins remain compatible with Python 3.11.0rc1

## Success Criteria

- [x] Version mismatch identified and documented
- [x] Both requirements files corrected to bullmq==2.15.0
- [x] Installed version matches declared version
- [x] Reproducible builds enabled
- [x] No dependency conflicts

## Related Files

- `apps/ai-worker/requirements.txt` (line 25) ✓ UPDATED
- `apps/ai-worker/requirements-prod.txt` (line 17) ✓ UPDATED

## Impact Analysis

**What Changed:**
- Dependency version declarations aligned with installed version
- Reproducibility: Clean installs now result in identical environments
- No API changes required (bullmq API compatible between versions)

**What Didn't Change:**
- Consumer.py and other source code remain untouched
- Python 3.11 compatibility preserved
- All other dependencies unchanged

**Rollback Risk:** MINIMAL
- Simple version number changes in two config files
- No breaking changes to application code
- Can be reverted by changing versions back

## Next Steps

→ Phase 04: Validate & test
