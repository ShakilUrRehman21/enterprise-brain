# Self-contained backend image. Build context is this folder:
#   docker build -t enterprise-brain-api ./backend
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app
COPY evaluation ./evaluation

# Database and uploads default to /app/data (override with DATABASE_URL / UPLOAD_DIR).
RUN useradd --create-home --uid 10001 brain && mkdir -p /app/data/uploads && chown -R brain /app
USER brain

# Hosts like Render inject $PORT; default to 8000 locally.
ENV PORT=8000
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/health')"
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
