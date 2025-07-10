# Multi-stage build for VR Streaming Engine with GPU support
FROM nvidia/cuda:12.2-devel-ubuntu22.04 AS builder

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    python3 \
    python3-pip \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../shared ./shared

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

FROM nvidia/cuda:12.2-runtime-ubuntu22.04 AS runtime

# Install Node.js and required libraries
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libxrender1 \
    libxext6 \
    libx11-6 \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodeuser

# Create necessary directories
RUN mkdir -p /app/logs /app/temp && \
    chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Expose ports
EXPOSE 3003 9000/udp

# Environment variables for GPU
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=all

CMD ["node", "src/index.js"]
