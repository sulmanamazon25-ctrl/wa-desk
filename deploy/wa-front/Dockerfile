# WhatsApp AI Desk — marketing frontend only (no Postgres, no Stripe secrets)
FROM node:20-alpine AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_APP_URL=http://46.62.226.89:3025
ARG NEXT_PUBLIC_API_ORIGIN=http://194.9.62.143:3025
ARG NEXT_PUBLIC_DOWNLOAD_URL=http://46.62.226.89:3025/download
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_DOWNLOAD_URL=$NEXT_PUBLIC_DOWNLOAD_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npx next build
RUN mkdir -p .next/standalone/.next \
  && cp -r .next/static .next/standalone/.next/static \
  && if [ -d public ]; then cp -r public .next/standalone/public; else mkdir -p .next/standalone/public; fi

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3025
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/.next/standalone ./
USER nextjs
EXPOSE 3025
CMD ["node", "server.js"]
