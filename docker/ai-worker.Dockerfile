FROM python:3.11-slim

WORKDIR /app

# System deps for Docling
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY apps/ai-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY apps/ai-worker/src ./src

ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "src.main"]
