# ========================================================
# Dockerfile - Student Attendance Management System
# Base Image: Node.js 20 on Debian Bookworm Slim
# ========================================================

FROM node:20-bookworm-slim

# Set working directory inside container
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install build dependencies if needed for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definition files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Ensure database directory exists with correct permissions
RUN mkdir -p /app/database

# Expose port
EXPOSE 3000

# Declare persistent volume mount point for SQLite database
VOLUME ["/app/database"]

# Healthcheck to verify server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/dashboard || exit 1

# Start the application
CMD ["node", "server.js"]
