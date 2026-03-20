# x-tweet-tracker-cron

Cron runner for x-tweet-tracker.

This service **does not** connect to Postgres directly — it:
- loads the account list from the API
- fetches recent posts from X API
- pushes new tweets back to the API for persistence

## Environment variables
- `API_BASE_URL` — e.g. `https://x-tweet-tracker-production.up.railway.app` (или `x-tweet-tracker.railway.internal` / `x-tweet-tracker.railway.internal:8080`)
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
