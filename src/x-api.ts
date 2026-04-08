import { mustEnv } from './env.js';
import { logInfo } from './logger.js';

export type XUser = {
  id: string;
  username: string;
};

type XMedia = {
  media_key: string;
  type: string;
  url?: string;
};

type XTweetApiRecord = {
  id: string;
  text: string;
  created_at?: string;
  attachments?: {
    media_keys?: string[];
  };
};

type XTweetsResponse = {
  data?: XTweetApiRecord[];
  includes?: {
    media?: XMedia[];
  };
  meta?: {
    newest_id?: string;
    result_count?: number;
  };
};

export type XTweet = {
  id: string;
  text: string;
  created_at?: string;
  mediaUrls: string[];
  raw: XTweetApiRecord;
};

const BASE = 'https://api.x.com/2';

function authHeaders() {
  const token = mustEnv('X_BEARER_TOKEN');
  return {
    authorization: `Bearer ${token}`,
  };
}

async function xFetch<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      url.searchParams.set(k, v);
    }
  }

  const startedAt = Date.now();
  const res = await fetch(url, {
    headers: {
      ...authHeaders(),
      'user-agent': 'x-tweet-tracker-cron/0.1',
    },
  });

  const durationMs = Date.now() - startedAt;
  logInfo('x_api_request_completed', {
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
      typeof body === 'object' && body && 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : typeof body === 'object' && body && 'title' in body && typeof body.title === 'string'
          ? body.title
          : `${res.status} ${res.statusText}`;

    const err = new Error(`X API error: ${msg}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = json;
    throw err;
  }

  return json as T;
}

function buildPhotoMediaMap(media: XMedia[] | undefined) {
  const map = new Map<string, string>();

  for (const item of media ?? []) {
    if (item.type !== 'photo') continue;
    if (!item.url) continue;
    map.set(item.media_key, item.url);
  }

  return map;
}

function toPhotoUrls(tweet: XTweetApiRecord, mediaMap: Map<string, string>) {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const mediaKey of tweet.attachments?.media_keys ?? []) {
    const url = mediaMap.get(mediaKey);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export async function getUserByUsername(username: string): Promise<XUser> {
  const clean = username.replace(/^@/, '').trim();
  const r = await xFetch<{ data: { id: string; username: string } }>(
    `/users/by/username/${encodeURIComponent(clean)}`,
  );
  return r.data;
}

export async function getUserTweets(args: {
  userId: string;
  sinceId?: string | null;
  maxResults?: number;
}): Promise<{ tweets: XTweet[]; newestId?: string }> {
  // X API v2 users/:id/tweets has min max_results=5
  const max = Math.min(Math.max(args.maxResults ?? 5, 5), 100);

  const r = await xFetch<XTweetsResponse>(`/users/${encodeURIComponent(args.userId)}/tweets`, {
    'tweet.fields': 'created_at,attachments',
    'media.fields': 'type,url',
    expansions: 'attachments.media_keys',
    // Keep only author's own tweets: exclude replies (incl. thread replies) and retweets
    exclude: 'replies,retweets',
    since_id: args.sinceId ?? undefined,
    max_results: String(max),
  });

  const mediaMap = buildPhotoMediaMap(r.includes?.media);
  const tweets = (r.data ?? []).map((tweet) => ({
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at,
    mediaUrls: toPhotoUrls(tweet, mediaMap),
    raw: tweet,
  }));

  return { tweets, newestId: r.meta?.newest_id };
}

export function tweetUrl(username: string, tweetId: string) {
  const clean = username.replace(/^@/, '').trim();
  return `https://x.com/${clean}/status/${tweetId}`;
}
