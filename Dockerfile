# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --silent --no-audit --no-fund
COPY frontend/ .
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --silent --no-audit --no-fund
COPY backend/ .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install nginx for serving frontend
RUN apk add --no-cache nginx

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist /var/www/html

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/

# Install only production dependencies for backend
WORKDIR /app/backend
RUN npm install --only=production

# Configure nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copy start script and make it executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 80

# Start both nginx and backend
CMD ["/app/start.sh"]
