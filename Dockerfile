# OpenShift-compatible Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for OpenShift compatibility
RUN useradd -m -u 1001 -s /bin/bash appuser

# Install Deno (as root, but in a location accessible to appuser)
RUN curl -fsSL https://deno.land/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -U bgutil-ytdlp-pot-provider

# Copy application files
COPY . .

# Make /app readable by all users (OpenShift runs as arbitrary UID)
RUN chmod -R g+rwX /app && \
    chmod -R o+rX /app

# Ensure /tmp is writable (OpenShift default)
RUN mkdir -p /tmp/temp && chmod -R 777 /tmp/temp

# Verify installations (non-blocking)
RUN echo "=== Build Diagnostics ===" && \
    which deno && deno --version && \
    which node && node --version && \
    which ffmpeg && ffmpeg -version && \
    python -c "from yt_dlp.dependencies import yt_dlp_ejs; print('yt-dlp-ejs:', bool(yt_dlp_ejs))" && \
    pip list | grep bgutil || echo "bgutil-ytdlp-pot-provider: check at runtime" && \
    echo "========================="

# Switch to non-root user (OpenShift will override with arbitrary UID, but this is good practice)
USER 1001

# Expose port 8080 (OpenShift default)
EXPOSE 8080

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
