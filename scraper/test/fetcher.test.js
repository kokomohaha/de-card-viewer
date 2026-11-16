import { describe, test, expect } from 'vitest';
import { createFetcher, FetchError } from '../fetcher.js';
import { USER_AGENT, assertConfigured } from '../config.js';

function fakeClock() {
  let t = 0;
  const sleeps = [];
  return {
    now: () => t,
    sleep: async (ms) => { sleeps.push(ms); t += ms; },
    advance: (ms) => { t += ms; },
    sleeps,
  };
}

function okResponse(body) {
  return { ok: true, status: 200, text: async () => body };
}

describe('createFetcher', () => {
  test('2回目の取得は前回から1000ms以上あけて行う', async () => {
    const c = fakeClock();
    const f = createFetcher({ fetchImpl: async () => okResponse('x'), sleep: c.sleep, now: c.now });
    await f.get('https://example.test/a');
    c.advance(300);
    await f.get('https://example.test/b');
    expect(c.sleeps).toEqual([700]);
  });

  test('User-Agent ヘッダーを付ける', async () => {
    const c = fakeClock();
    let seen;
    const f = createFetcher({
      fetchImpl: async (url, init) => { seen = init.headers['User-Agent']; return okResponse('x'); },
      sleep: c.sleep, now: c.now,
    });
    await f.get('https://example.test/a');
    expect(seen).toBe(USER_AGENT);
  });

  test('500 と通信エラーは2回失敗しても3回目で成功すれば本文を返す', async () => {
    const c = fakeClock();
    let n = 0;
    const f = createFetcher({
      fetchImpl: async () => {
        n++;
        if (n === 1) throw new Error('network');
        if (n === 2) return { ok: false, status: 500, text: async () => '' };
        return okResponse('body');
      },
      sleep: c.sleep, now: c.now,
    });
    await expect(f.get('https://example.test/a')).resolves.toBe('body');
    expect(n).toBe(3);
  });

  test('3回とも失敗したら例外', async () => {
    const c = fakeClock();
    let n = 0;
    const f = createFetcher({
      fetchImpl: async () => { n++; return { ok: false, status: 503, text: async () => '' }; },
      sleep: c.sleep, now: c.now,
    });
    await expect(f.get('https://example.test/a')).rejects.toThrow();
    expect(n).toBe(3);
  });

  test('post はフォーム形式の本文を POST で送る', async () => {
    const c = fakeClock();
    let seen;
    const f = createFetcher({
      fetchImpl: async (url, init) => { seen = { url, ...init }; return okResponse('ok'); },
      sleep: c.sleep, now: c.now,
    });
    await expect(f.post('https://example.test/card/', 'pagenum=2&samename=show')).resolves.toBe('ok');
    expect(seen.method).toBe('POST');
    expect(seen.body).toBe('pagenum=2&samename=show');
    expect(seen.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(seen.headers['User-Agent']).toBe(USER_AGENT);
  });

  test('404 は再試行せず FetchError(status=404) を投げる', async () => {
    const c = fakeClock();
    let n = 0;
    const f = createFetcher({
      fetchImpl: async () => { n++; return { ok: false, status: 404, text: async () => '' }; },
      sleep: c.sleep, now: c.now,
    });
    const err = await f.get('https://example.test/a').catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect(err.status).toBe(404);
    expect(n).toBe(1);
  });
});

describe('assertConfigured', () => {
  test('TODO が残っていると例外', () => {
    expect(() => assertConfigured({ siteUrl: 'TODO_SITE_URL', contactEmail: 'a@b.c' })).toThrow();
    expect(() => assertConfigured({ siteUrl: 'https://x.pages.dev', contactEmail: 'TODO_CONTACT_EMAIL' })).toThrow();
    expect(() => assertConfigured({ siteUrl: 'https://x.pages.dev', contactEmail: 'a@b.c' })).not.toThrow();
  });
});
