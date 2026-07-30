FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY "cursos bex Moodle.xlsx" ./cursos bex Moodle.xlsx
COPY "compresor_video/carpeta para el video" "./compresor_video/carpeta para el video"

RUN mkdir -p \
    compresor_video/input \
    compresor_video/output \
    compresor_video/temp/jobs \
    compresor_video/temp/processing \
    compresor_video/temp/paquetes \
    compresor_video/logs \
    compresor_video/bin

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV APP_ENV=production
ENV MATRIZ_CURSOS_PATH=/app/cursos bex Moodle.xlsx
ENV COMPRESOR_ROOT=/app/compresor_video

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
