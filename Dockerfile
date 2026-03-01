FROM node:20-slim

# Labels for Docker Hub
LABEL maintainer="Carl John Villavito"
LABEL description="Minecraft Bedrock 24/7 AFK Bot"
LABEL version="1.0.0"

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    g++ \
    make \
    cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy app files
COPY index.js ./

# Create directory for auth cache
RUN mkdir -p /app/auth

# Set environment variables
ENV MC_HOST=TheHulagens.aternos.me
ENV MC_PORT=40436
ENV MC_USERNAME=emeraldgod3v
ENV AFK_MODE=passive

# Run the bot
CMD ["node", "index.js"]
