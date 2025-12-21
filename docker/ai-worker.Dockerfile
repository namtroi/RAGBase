# =============================================================================
# STAGE 1: Builder - Install dependencies with build tools
# =============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

# System dependencies for building native packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY apps/ai-worker/requirements.txt .
COPY apps/ai-worker/requirements-prod.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements-prod.txt

# =============================================================================
# STAGE 2: Production - Slim runtime image
# =============================================================================
FROM python:3.11-slim AS production

WORKDIR /app

# Runtime dependencies only
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source
COPY apps/ai-worker/src ./src

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python", "-m", "src.main"]
