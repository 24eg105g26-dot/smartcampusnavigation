# ==============================================================
# Production Dockerfile for Campus Navigation System
# Lightweight Node.js Alpine base (~160MB total size)
# ==============================================================

FROM node:20-alpine AS runner

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install wget for container healthcheck
RUN apk add --no-cache wget

# Create application directory
WORKDIR /app

# Copy dependency manifests first for efficient Docker layer caching
COPY backend/package*.json ./backend/

# Install only production dependencies
WORKDIR /app/backend
RUN npm install --omit=dev && npm cache clean --force

# Copy application source code
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend

# Change ownership to non-root node user for container security
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Working directory for running the backend
WORKDIR /app/backend

# Expose server port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start the Node.js application server
CMD ["node", "server.js"]
