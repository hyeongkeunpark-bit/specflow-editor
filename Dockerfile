# syntax=docker/dockerfile:1.7

# ── Build stage: Vite 정적 빌드 ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime stage: Express가 dist/ + /api/* 서빙 ──
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig*.json ./

# 런타임에서 읽는 시스템 프롬프트 + DB 지식 파일
COPY --from=builder /app/prompt-v4-prototype-first.md ./
COPY --from=builder /app/product-spec-v2-template.txt ./
COPY --from=builder /app/wanted-db-knowledge.md ./
COPY --from=builder /app/wanted-db-catalog.md ./
COPY --from=builder /app/wanted-db-context.md ./

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
