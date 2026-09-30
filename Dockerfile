# syntax=docker/dockerfile:1

# ---- Build stage: install production dependencies (compiles better-sqlite3 if no prebuilt binary) ----
FROM node:22-bookworm-slim AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- Runtime stage ----
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json eyezo.js ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Database and thumbnail cache live in ~/.local/eyezo-server; pre-create it so
# a mounted named volume inherits ownership by the unprivileged node user.
RUN mkdir -p /home/node/.local/eyezo-server/thumbnails /videos \
 && chown -R node:node /home/node/.local

USER node

VOLUME ["/home/node/.local/eyezo-server"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "eyezo.js", "/videos"]
