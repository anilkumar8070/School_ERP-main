FROM node:22-alpine

WORKDIR /app

# Install OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

# Copy dependency manifests and Prisma schema first for efficient docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source files
COPY . .

# Expose application port
EXPOSE 4000

# Push database schema migrations and start express server
CMD ["sh", "-c", "npx prisma db push && npm start"]
