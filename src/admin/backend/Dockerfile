FROM node:18-alpine
WORKDIR /app

# Copy package manifests from repo root (we rely on root package.json)
COPY package.json package-lock.json* ./

# Install dependencies (production)
RUN npm ci --production || npm install --production

# Copy repository files
COPY . .

EXPOSE 5000
CMD ["node", "src/admin/backend/server.cjs"]
