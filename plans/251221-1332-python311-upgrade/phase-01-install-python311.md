# Phase 01: Install Python 3.11

**Parent:** [plan.md](./plan.md) | **Status:** COMPLETED | **Priority:** P1 | **Completed:** 2025-12-21T13:32

## Objective

Install Python 3.11 on Ubuntu 22.04 via deadsnakes PPA without affecting system Python 3.10.

## Requirements

- Ubuntu 22.04 LTS (Jammy)
- sudo access
- Internet connection

## Implementation Steps

1. **Add deadsnakes PPA:**
   ```bash
   sudo add-apt-repository ppa:deadsnakes/ppa -y
   sudo apt update
   ```

2. **Install Python 3.11 + dev tools:**
   ```bash
   sudo apt install -y \
     python3.11 \
     python3.11-venv \
     python3.11-dev
   ```

3. **Verify installation:**
   ```bash
   python3.11 --version  # Should show 3.11.x
   which python3.11      # Should show /usr/bin/python3.11
   ```

4. **Confirm system Python untouched:**
   ```bash
   python3 --version     # Should still show 3.10.12
   ```

## Success Criteria

- [x] `python3.11 --version` returns 3.11.x
- [x] System `python3` still 3.10.12
- [x] `python3.11-venv` package installed

## Risks

- **PPA unavailable:** Use official Python tarball (slower)
- **Disk space:** Python 3.11 adds ~150MB

## Next Steps

→ Phase 02: Create venv & migrate deps
