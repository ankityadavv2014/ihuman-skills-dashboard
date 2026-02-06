# Docker Deployment Guide

## Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY packages/web ./packages/web
COPY bin ./bin

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "packages/web/server.js"]
```

## Build and Run

```bash
# Build image
docker build -t ihuman:latest .

# Run container
docker run -d \
  --name ihuman \
  -p 5173:5173 \
  -e DB_HOST=db \
  -e JWT_SECRET=your-secret \
  -e NODE_ENV=production \
  ihuman:latest

# View logs
docker logs -f ihuman

# Stop container
docker stop ihuman
docker rm ihuman
```

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=secure_password
      - JWT_SECRET=your-secret-key
      - LOG_LEVEL=info
    depends_on:
      - db
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5173/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=ihuman_db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./packages/web/db/schema.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

## Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f web

# Stop services
docker-compose down

# Restart
docker-compose restart
```

## Production Checklist

- [ ] Set strong JWT_SECRET
- [ ] Enable HTTPS (use reverse proxy)
- [ ] Set NODE_ENV=production
- [ ] Configure database backups
- [ ] Setup logging aggregation
- [ ] Enable health checks
- [ ] Configure resource limits
- [ ] Setup monitoring alerts
