# Uses a pre-built image that contains fully compiled ffmpeg and python tools
FROM jrottenberg/ffmpeg:4.4-ubuntu AS ffmpeg
FROM python:3.10-slim

# Copy the pre-compiled ffmpeg binaries and libraries over
COPY --from=ffmpeg / /

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

# Install basic compiler tools so python packages can map to the pre-built ffmpeg seamlessly
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

EXPOSE 5000

CMD ["python", "app.py"]