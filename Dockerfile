# Alternative to nixpacks.toml - use this if Runway supports Dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno
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
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Verify installations
RUN echo "=== Build Diagnostics ===" && \
    which deno && deno --version && \
    which node && node --version && \
    which ffmpeg && ffmpeg -version && \
    python -c "from yt_dlp.dependencies import yt_dlp_ejs; print('yt-dlp-ejs:', bool(yt_dlp_ejs))" && \
    echo "========================="

# Expose port
ENV PORT=8080
EXPOSE 8080

# Run the application
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
