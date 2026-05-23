FROM node:20-slim

WORKDIR /app

# Copy package files first for layer caching
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source + pre-built frontend in public/
COPY backend/ ./

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

# Antigravity / Cloud Run inject GEMINI_API_KEY via env at runtime
CMD ["node", "server.js"]
