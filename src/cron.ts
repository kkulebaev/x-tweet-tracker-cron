import 'dotenv/config';
import { mustEnv } from './env.js';
import { getUserByUsername, getUserTweets, tweetUrl } from './x-api.js';

type AccountDTO = {
  id: string;
  xUsername: string;
  xUserId: string | null;
  sinceId: string | null;
  enabled: boolean;
};

function normalizeBaseUrl() {
  let base = mustEnv('API_BASE_URL').trim().replace(/\/$/, '');

  const hasScheme = /^https?:\/\//i.test(base);
  if (!hasScheme) {
    const isRailwayInternal = /\.railway\.internal(?::\d+)?$/i.test(base);
    const scheme = isRailwayInternal ? 'http' : 'https';
    base = `${scheme}://${base}`;
  }

  try {
    const u = new URL(base);
    if (u.hostname.toLowerCase().endsWith('.railway.internal') && !u.port) {
      u.port = '8080';
      base = u.toString().replace(/\/$/, '');
    }
  } catch {
    // ignore
  }

  return base;
}

async function apiFetch(path: string, init?: RequestInit) {
  const base = normalizeBaseUrl();
  const token = mustEnv('API_TOKEN');
  const res = await fetch(base + path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const body = typeof json === 'object' && json ? json : {};
    const msg =
      typeof body === 'object' && body && 'error' in body && typeof body.error === 'string'
        ? body.error
        : typeof body === 'object' && body && 'message' in body && typeof body.message === 'string'
          ? body.message
          : `${res.status} ${res.statusText}`;
    throw new Error(`API error: ${msg}`);
  }

  return json;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const accountsResp = (await apiFetch('/admin/accounts')) as { accounts?: AccountDTO[] };
  const accounts: AccountDTO[] = accountsResp.accounts ?? [];

  let totalInserted = 0;
  const errors: Array<{ xUsername: string; error: string }> = [];

  for (const acc of accounts) {
    if (!acc.enabled) continue;

    try {
      // Resolve x_user_id if needed
      let xUserId = acc.xUserId;
      if (!xUserId) {
        const u = await getUserByUsername(acc.xUsername);
        xUserId = u.id;
        await apiFetch(`/admin/accounts/${encodeURIComponent(acc.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ x_user_id: xUserId }),
        });
      }

      const { tweets, newestId } = await getUserTweets({ userId: xUserId, sinceId: acc.sinceId, maxResults: 5 });

      const payloadTweets = tweets.map((t) => ({
        id: t.id,
        text: t.text,
        created_at: t.created_at,
        url: tweetUrl(acc.xUsername, t.id),
        mediaUrls: t.mediaUrls,
        raw: t.raw,
      }));

      await apiFetch('/admin/tweets/push', {
        method: 'POST',
        body: JSON.stringify({
          accountId: acc.id,
          newestId: newestId ?? null,
          tweets: payloadTweets,
        }),
      });

      totalInserted += payloadTweets.length;

      await sleep(250);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ xUsername: acc.xUsername, error: message });
      // Backoff a bit on errors to avoid thundering herd
      await sleep(1500);
    }
  }

  console.log(JSON.stringify({ ok: true, inserted: totalInserted, errors }, null, 2));
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exitCode = 1;
});
