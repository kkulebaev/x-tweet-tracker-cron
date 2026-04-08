FROM oven/bun:1.3.11-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
COPY src ./src
CMD ["bun", "src/cron.ts"]
