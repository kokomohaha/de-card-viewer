import { USER_AGENT, MIN_INTERVAL_MS } from './config.js';

export class FetchError extends Error {
  constructor(url, status) {
    super(`Fetch failed: ${status} ${url}`);
    this.url = url;
    this.status = status;
  }
}

const RETRY_DELAYS_MS = [5000, 15000, 45000];
const MAX_ATTEMPTS = 3;

/**
 * 公式サイトに負担をかけないよう、前回の取得から minIntervalMs 以上あけて取得する。
 */
export function createFetcher({
  minIntervalMs = MIN_INTERVAL_MS,
  userAgent = USER_AGENT,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
} = {}) {
  let last = null;

  async function waitTurn() {
    if (last !== null) {
      const wait = minIntervalMs - (now() - last);
      if (wait > 0) await sleep(wait);
    }
    last = now();
  }

  async function request(url, init) {
    let lastErr;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]);
      await waitTurn();
      try {
        const res = await fetchImpl(url, init);
        if (res.ok) return await res.text();
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          throw new FetchError(url, res.status);
        }
        lastErr = new FetchError(url, res.status);
      } catch (e) {
        if (e instanceof FetchError && e.status >= 400 && e.status < 500 && e.status !== 429) throw e;
        lastErr = e;
      }
    }
    throw lastErr;
  }

  const get = (url) => request(url, { headers: { 'User-Agent': userAgent } });
  const post = (url, body) =>
    request(url, {
      method: 'POST',
      body,
      headers: { 'User-Agent': userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
    });

  return { get, post };
}
