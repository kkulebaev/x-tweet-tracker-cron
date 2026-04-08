import 'dotenv/config';
import { mustEnv } from './env.js';
import { logError, logInfo, serializeError } from './logger.js';
import { getUserByUsername, getUserTweets, tweetUrl } from './x-api.js';

type AccountDTO = {
  id: string;
  xUsername: string;
  xUserId: string | null;
  sinceId: string | null;
  enabled: boolean;
};

type AccountsResponse = {
  accounts?: AccountDTO[];
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
  const startedAt = Date.now();
  const method = init?.method ?? 'GET';

  const res = await fetch(base + path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  const durationMs = Date.now() - startedAt;
  logInfo('api_request_completed', {
    method,
    path,
    status: res.status,
    durationMs,
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
  const baseUrl = normalizeBaseUrl();
  logInfo('cron_started', {
    apiBaseUrl: baseUrl,
  });

  const accountsResp = (await apiFetch('/admin/accounts')) as AccountsResponse;
  const accounts: AccountDTO[] = accountsResp.accounts ?? [];
  const enabledAccounts = accounts.filter((account) => account.enabled);

  logInfo('accounts_loaded', {
    total: accounts.length,
    enabled: enabledAccounts.length,
    disabled: accounts.length - enabledAccounts.length,
  });

  let totalInserted = 0;
  let processedAccounts = 0;
  const errors: Array<{ xUsername: string; error: string }> = [];

  for (const acc of accounts) {
    if (!acc.enabled) {
      logInfo('account_skipped_disabled', {
        accountId: acc.id,
        xUsername: acc.xUsername,
      });
      continue;
    }

    logInfo('account_processing_started', {
      accountId: acc.id,
      xUsername: acc.xUsername,
      hasXUserId: Boolean(acc.xUserId),
      sinceId: acc.sinceId,
    });

    try {
      let xUserId = acc.xUserId;
      if (!xUserId) {
        logInfo('account_resolving_x_user_id', {
          accountId: acc.id,
          xUsername: acc.xUsername,
        });

        const u = await getUserByUsername(acc.xUsername);
        xUserId = u.id;

        await apiFetch(`/admin/accounts/${encodeURIComponent(acc.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ x_user_id: xUserId }),
        });

        logInfo('account_x_user_id_resolved', {
          accountId: acc.id,
          xUsername: acc.xUsername,
          xUserId,
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
      processedAccounts += 1;

      logInfo('account_processing_succeeded', {
        accountId: acc.id,
        xUsername: acc.xUsername,
        tweetsFetched: tweets.length,
        tweetsInserted: payloadTweets.length,
        tweetsWithMedia: payloadTweets.filter((tweet) => tweet.mediaUrls.length > 0).length,
        newestId: newestId ?? null,
      });

      await sleep(250);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ xUsername: acc.xUsername, error: message });

      logError('account_processing_failed', {
        accountId: acc.id,
        xUsername: acc.xUsername,
        error: serializeError(error),
      });

      // Backoff a bit on errors to avoid thundering herd
      await sleep(1500);
    }
  }

  logInfo('cron_finished', {
    ok: true,
    accountsTotal: accounts.length,
    accountsProcessed: processedAccounts,
    inserted: totalInserted,
    errorsCount: errors.length,
    errors,
  });
}

main().catch((error) => {
  logError('cron_failed', {
    error: serializeError(error),
  });
  process.exitCode = 1;
});
