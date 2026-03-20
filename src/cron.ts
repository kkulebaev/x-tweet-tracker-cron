import 'dotenv/config';
import { mustEnv } from './env.js';

async function main() {
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
  const token = mustEnv('API_TOKEN');

  const res = await fetch(base + '/admin/run', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API call failed: ${res.status} ${res.statusText} :: ${text}`);
  }

  console.log(text);
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exitCode = 1;
});
