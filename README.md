<p align="center">
  <img src="./assets/voyager-cron-banner.svg" alt="Voyager Cron banner" />
</p>

<p align="center">
  Cron worker for x-tweet-tracker (fetches from X API, persists via Voyager API)
</p>

<p align="center">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Node.js-339933" />
  <img alt="deploy" src="https://img.shields.io/badge/deploy-Railway-6B46C1" />
  <img alt="source" src="https://img.shields.io/badge/source-X%20API-111827" />
</p>

# x-tweet-tracker-cron

This service runs on a schedule:
1) loads accounts from the API
2) fetches recent posts from X API
3) expands attached X media for photos
4) pushes tweets back to the API (`/admin/tweets/push`) for persistence

No direct DB access.

## Current media behavior
- fetches attached media through X API expansions
- keeps only `photo` media for now
- sends `mediaUrls: string[]` per tweet to the API
- if X returns no photo media for a tweet, sends an empty array

## Logging
- emits structured JSON logs to stdout
- logs cron start and finish, account-level progress, API calls, X API calls, and per-account failures
- designed for easy filtering in Railway logs by `event`, `xUsername`, `accountId`, `status`, or `durationMs`

## Environment variables
- `API_BASE_URL`
  - public: `https://x-tweet-tracker-production.up.railway.app`
  - private (Railway): `x-tweet-tracker.railway.internal` (auto → `http://...:8080`)
- `API_TOKEN` — same value as API `ADMIN_TOKEN`
- `X_BEARER_TOKEN` — X API Bearer token

## Local run
```bash
npm ci
npm run dev
```

## Railway Cron
Build:
```bash
npm ci && npm run build
```

Command:
```bash
npm start
```

Schedule:
- `0 * * * *` (hourly)

## Docker
Build the image:
```bash
docker build -t x-tweet-tracker-cron .
```

Run the container:
```bash
docker run --rm \
  -e API_BASE_URL \
  -e API_TOKEN \
  -e X_BEARER_TOKEN \
  x-tweet-tracker-cron
```
