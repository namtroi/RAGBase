# RAGBase Security Audit Report

This report summarizes the findings of a codebase-wide security check conducted prior to production deployment.

## 1. Dependency Vulnerabilities (SCA)

> [!WARNING]
> Several high and moderate severity vulnerabilities were found in both Node and Python dependencies.

**Node.js Workspaces (Frontend & Backend)**
Running `pnpm audit` revealed **24 vulnerabilities** (3 Low, 11 Moderate, 10 High). Notable examples:
- **`fastify`** (backend): Vulnerable to DoS via Unbounded Memory Allocation.
- **`qs`** (backend): Array limit bypass allows DoS.
- **`hono`** (backend): Timing comparison issues.
*Recommendation:* Run `pnpm audit fix` or update the affected packages manually.

**Python (AI-Worker)**
Running `pip-audit` revealed **1 vulnerability**:
- **`pillow` (v11.3.0)**: Out-of-bounds write may be triggered when loading a specially crafted PSD image ([CVE-2026-25990]).
*Recommendation:* Update `pillow` to `12.1.1` in `apps/ai-worker/requirements-prod.txt`.

## 2. Infrastructure & Docker Misconfigurations

> [!CAUTION]
> The Backend Dockerfile uses a risky database operation for production, and all containers run as root.

**Backend Dockerfile (`apps/backend/Dockerfile`)**:
1. **Single-Stage Build**: The current setup leaves build tools (`python3`, `make`, `g++`) inside the production image, increasing the attack surface. An attacker gaining access to the container could easily compile exploits.
2. **Root User Permissions**: The app runs as the `root` user instead of a less privileged user (like `node`).
3. **Dangerous Production Command**: The `CMD` uses `npx prisma db push`. In production, this can aggressively force schema changes and easily lead to **data loss**. It should be `npx prisma migrate deploy`.

**Frontend Dockerfile (`apps/frontend/Dockerfile`)**:
1. **Root User Permissions**: The Nginx process runs as root. Consider switching to `nginxinc/nginx-unprivileged` for the base image.

**AI-Worker Dockerfile (`apps/ai-worker/Dockerfile`)**:
1. **Root User Permissions**: Python processes run as root. 

**Docker Compose (`docker-compose.yml`)**:
1. **Unnecessary Port Exposure**: The backend service exposes port `3000:3000` to the host. Usually, only the proxy (Nginx on port `80/443`) should be exposed to the outside, routing traffic internally to the backend. Exposing the backend directly bypasses the Nginx configuration.

**Nginx Configuration (`apps/frontend/nginx.conf`)**:
1. **Missing Security Headers**: The configuration does not include standard security headers (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`).

## 3. Static Code Analysis (SAST)

> [!NOTE]
> Static code analysis did not reveal any critical code-level security flaws, but some improvements can be made.

**Python / AI-Worker**:
Running `bandit` found 3 issues:
- **Medium Severity**: Binding to all interfaces `0.0.0.0` inside `src/main.py`. Since this runs within a Docker container and isn't exposed directly outside the host network without docker-compose mapping, this is an acceptable risk.
- **Low Severity**: Two instances of `try: ... except Exception: pass` in `src/converters/epub_converter.py` and `pptx_converter.py`. Silencing exceptions completely can mask underlying failures and make debugging difficult.

## 4. Secret Scanning

- A search across the codebase for common hardcoded secret patterns (passwords, API keys, tokens) returned **no results**. The application appears to correctly utilize `.env` files and environment variables.

---

### Recommended Next Steps for Production:
1. Fix dependency vulnerabilities (`pnpm update`, bump `pillow` to `12.1.1`).
2. Update the `backend` Dockerfile to use a multi-stage build, change the user to `node`, and change `prisma db push` to `prisma migrate deploy`.
3. Modify `docker-compose.yml` to remove the `ports: ["3000:3000"]` mapping from the backend service.
4. Add standard security headers to `nginx.conf`.
