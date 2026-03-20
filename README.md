# x-tweet-tracker-cron

Cron runner for x-tweet-tracker.

This service **does not** connect to Postgres directly — it calls the API endpoint `/admin/run`.

## Environment variables
- `API_BASE_URL` — e.g. `https://x-tweet-tracker-production.up.railway.app` (или `x-tweet-tracker.railway.internal`)
- `API_TOKEN` — same value as API `ADMIN_TOKEN`

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
