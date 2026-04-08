<p align="center">
  <img src="./assets/voyager-cron-banner.svg" alt="Voyager Cron banner" />
</p>

<p align="center">
  Cron worker for x-tweet-tracker (fetches from X API, persists via Voyager API)
</p>

<p align="center">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Bun-F472B6" />
  <img alt="container" src="https://img.shields.io/badge/container-Dockerfile-2496ED?logo=docker&logoColor=white" />
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

## Environment variables
- `API_BASE_URL`
  - public: `https://x-tweet-tracker-production.up.railway.app`
  - private (Railway): `x-tweet-tracker.railway.internal` (auto → `http://...:8080`)
- `API_TOKEN` — same value as API `ADMIN_TOKEN`
- `X_BEARER_TOKEN` — X API Bearer token

## Local run
```bash
bun install
bun run dev
```

## Railway Cron
Build:
```bash
echo "No build step required"
```

Command:
```bash
bun run start
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

