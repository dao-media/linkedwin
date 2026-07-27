# LinkedWin Fly worker — runs Playwright reposts / second comments
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app
COPY package.json package-lock.json ./
# tsx is a production dependency (worker entry is TypeScript)
RUN npm ci --omit=dev
COPY . .

ENV PLAYWRIGHT_ENABLED=true
ENV PLAYWRIGHT_HEADLESS=true
ENV NODE_ENV=production

CMD ["npx", "tsx", "worker/process-jobs.ts"]
