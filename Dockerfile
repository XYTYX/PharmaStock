# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN VITE_API_URL=/api npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate && npm run build

# Stage 3: Production runtime
FROM node:18-alpine

# Prisma's query engine binary requires OpenSSL at runtime
RUN apk add --no-cache openssl

# Copy Litestream binary from official image (no network dependency at build time)
COPY --from=litestream/litestream /usr/local/bin/litestream /usr/local/bin/litestream

WORKDIR /app

# Backend
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/package.json ./

# Frontend static files served by Express
COPY --from=frontend-builder /app/frontend/dist ./public

COPY litestream.yml ./
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000
CMD ["./start.sh"]
