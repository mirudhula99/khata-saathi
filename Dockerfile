# Khata Saathi on Fly.io. The React app is prebuilt into static/app, so no Node step here.
FROM python:3.12-slim

# ffmpeg turns browser recordings (WebM/MP4) into the WAV that speech-to-text takes.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY static ./static
RUN mkdir -p data

ENV PYTHONUNBUFFERED=1
EXPOSE 8080
# One worker: SQLite, the reminder scheduler and the live-events bus all live in this process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-graceful-shutdown", "3"]
