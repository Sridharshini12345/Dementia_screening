FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Prevents heavy memory consumption during installation
ENV PIP_NO_CACHE_DIR=1 

# Install system multimedia dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    build-essential \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt

# Force pip to build items sequentially using less memory
RUN pip install --no-cache-dir --submodules -r /app/requirements.txt

COPY . /app

EXPOSE 5000

CMD ["python", "app.py"]