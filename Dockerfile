FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY MATRIZ_CURSOS_BEX.xlsx ./MATRIZ_CURSOS_BEX.xlsx

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV APP_ENV=production

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
