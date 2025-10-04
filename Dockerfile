# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
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
RUN npm ci --only=production

# Configure nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start both nginx and backend
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
