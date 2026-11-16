import { describe, test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScrape, ValidationFailed } from '../run.js';
import { saveState, loadState } from '../state.js';

const detailHtml = fs.readFileSync(new URL('./fixtures/detail-creature.html', import.meta.url), 'utf8');
const DAY = 24 * 60 * 60 * 1000;

function listHtml(ids, page, lastPage) {
  const nav = `<div class="wp-pagenavi"><span class="current">${page}</span>${
    page < lastPage ? `<a class="nextpostslink" data-page="${lastPage}">最後のページ</a>` : ''
  }</div>`;
  const imgs = ids
    .map((id) => `<img class='cardImage' data-href='/card/detail/?id=${id}' src='/wp-content/card/cardthumb/${id}.jpg'>`)
    .join('');
  return `<html><body><select name="race"><option value="">指定なし</option><option value="a">ドラゴン</option></select>
<select name="rarity"><option value="c">C</option></select><select name="ability"><option value="x">ブロッカー</option></select>
<select name="cardtype"><option value="クリーチャー">クリーチャー</option></select><select name="products"><option value="p">DM01 パック</option></select>
${nav}${imgs}<div class="rowCopy"><p>TM and &copy;TOMY</p></div></body></html>`;
}

/** 公式サイトの偽物。全カード ids を2件ずつのページに分ける。 */
function fakeSite({ all, current = [], original = all, broken = [] }) {
  const calls = { details: [], lists: 0 };
  const pages = (ids) => {
    const out = [];
    for (let i = 0; i < ids.length; i += 2) out.push(ids.slice(i, i + 2));
    return out.length ? out : [[]];
  };
  return {
    calls,
    fetcher: {
      async post(url, body) {
        calls.lists++;
        const p = new URLSearchParams(body);
        const page = Number(p.get('pagenum'));
        const fmt = p.get('format');
        const ids = fmt === 'current' ? current : fmt === 'original' ? original : all;
        const ps = pages(ids);
        return listHtml(ps[page - 1] ?? [], page, ps.length);
      },
      async get(url) {
        const id = new URL(url).searchParams.get('id');
        calls.details.push(id);
        if (broken.includes(id)) return '<html><body>メンテナンス中</body></html>';
        return detailHtml;
      },
    },
  };
}

let dir;
let paths;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmrun-'));
  paths = {
    cards: path.join(dir, 'site/data/cards.json'),
    meta: path.join(dir, 'site/data/meta.json'),
    state: path.join(dir, 'scraper/state.json'),
    cache: path.join(dir, 'scraper/.cache/full.json'),
  };
});
const readCards = () => JSON.parse(fs.readFileSync(paths.cards, 'utf8'));

describe('runScrape', () => {
  test('auto: 最近更新済みなら none で何も書かない', async () => {
    const t = Date.parse('2026-11-17T00:00:00Z');
    saveState(paths.state, { lastFullAt: new Date(t - 2 * DAY).toISOString(), lastIncrementalAt: new Date(t - DAY).toISOString(), full: null });
    const site = fakeSite({ all: ['a-1'] });
    const r = await runScrape({ mode: 'auto', fetcher: site.fetcher, now: () => t, paths, maxMinutes: 330 });
    expect(r).toEqual({ action: 'none', written: false });
    expect(site.calls.lists).toBe(0);
    expect(fs.existsSync(paths.cards)).toBe(false);
  });

  test('auto: 一度も全件読み取りしていなければ full を始める', async () => {
    const site = fakeSite({ all: ['a-1', 'a-2', 'a-3'] });
    const r = await runScrape({ mode: 'auto', fetcher: site.fetcher, now: () => 0, paths, maxMinutes: 330 });
    expect(r.action).toBe('full-done');
    expect(readCards().map((c) => c.id)).toEqual(['a-1', 'a-2', 'a-3']);
  });

  test('auto: 全件から30日未満・差分から7日以上なら incremental', async () => {
    const t = Date.parse('2026-11-17T00:00:00Z');
    saveState(paths.state, { lastFullAt: new Date(t - 10 * DAY).toISOString(), lastIncrementalAt: new Date(t - 8 * DAY).toISOString(), full: null });
    const site = fakeSite({ all: ['a-1'] });
    const r = await runScrape({ mode: 'auto', fetcher: site.fetcher, now: () => t, paths, maxMinutes: 330 });
    expect(r.action).toBe('incremental');
    expect(loadState(paths.state).lastIncrementalAt).toBe(new Date(t).toISOString());
  });

  test('incremental: 新しいIDだけ詳細を取得する', async () => {
    fs.mkdirSync(path.dirname(paths.cards), { recursive: true });
    const old = { id: 'a-2', name: '既存', type: 'クリーチャー', civilizations: ['火'], image: '/x.jpg', second: null };
    fs.writeFileSync(paths.cards, JSON.stringify([old]));
    const site = fakeSite({ all: ['a-1', 'a-2'] });
    const r = await runScrape({ mode: 'incremental', fetcher: site.fetcher, now: () => 0, paths, maxMinutes: 330 });
    expect(r).toEqual({ action: 'incremental', written: true });
    expect(site.calls.details).toEqual(['a-1']);
    const cards = readCards();
    expect(cards.map((c) => c.id)).toEqual(['a-1', 'a-2']);
    expect(cards[1].name).toBe('既存');
  });

  test('formats・releaseOrder・thumb が付き、meta.json が書かれる', async () => {
    const site = fakeSite({ all: ['a-1', 'a-2', 'a-3'], current: ['a-1'], original: ['a-1', 'a-2'] });
    await runScrape({ mode: 'incremental', fetcher: site.fetcher, now: () => 0, paths, maxMinutes: 330 });
    const [c1, c2, c3] = readCards();
    expect(c1.formats).toEqual(['original', 'current']);
    expect(c2.formats).toEqual(['original']);
    expect(c3.formats).toEqual([]);
    expect(c1.releaseOrder).toBeGreaterThan(c2.releaseOrder);
    expect(c2.releaseOrder).toBeGreaterThan(c3.releaseOrder);
    expect(c1.thumb).toBe('/wp-content/card/cardthumb/a-1.jpg');
    const meta = JSON.parse(fs.readFileSync(paths.meta, 'utf8'));
    expect(meta).toMatchObject({ count: 3, rightsNotice: 'TM and ©TOMY', updatedAt: new Date(0).toISOString() });
    expect(meta.options.races).toEqual(['ドラゴン']);
  });

  test('full: 時間切れで full-progress。cards.json は変わらず、次の実行で続きから再開する', async () => {
    fs.mkdirSync(path.dirname(paths.cards), { recursive: true });
    fs.writeFileSync(paths.cards, '[{"id":"old-1"}]');
    let t = 0;
    const site = fakeSite({ all: ['a-1', 'a-2', 'a-3', 'a-4'] });
    const fetcher = {
      post: site.fetcher.post,
      get: async (url) => { t += 60 * 1000; return site.fetcher.get(url); }, // 1件ごとに1分進む
    };
    const r1 = await runScrape({ mode: 'full', fetcher, now: () => t, paths, maxMinutes: 2 });
    expect(r1).toEqual({ action: 'full-progress', written: false });
    expect(fs.readFileSync(paths.cards, 'utf8')).toBe('[{"id":"old-1"}]');
    const s = loadState(paths.state);
    expect(s.full.doneIds.length).toBeGreaterThan(0);
    expect(s.full.pendingIds.length).toBeGreaterThan(0);

    const before = site.calls.details.length;
    const r2 = await runScrape({ mode: 'auto', fetcher, now: () => t, paths, maxMinutes: 330 });
    expect(r2).toEqual({ action: 'full-done', written: true });
    expect(site.calls.details.length - before).toBe(s.full.pendingIds.length);
    expect(readCards().map((c) => c.id)).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
    expect(loadState(paths.state).full).toBeNull();
  });

  test('検証エラーがあると ValidationFailed で何も書かない', async () => {
    const site = fakeSite({ all: ['a-1', 'a-2'], broken: ['a-2'] });
    await expect(
      runScrape({ mode: 'incremental', fetcher: site.fetcher, now: () => 0, paths, maxMinutes: 330 }),
    ).rejects.toBeInstanceOf(ValidationFailed);
    expect(fs.existsSync(paths.cards)).toBe(false);
    expect(fs.existsSync(paths.meta)).toBe(false);
  });

  test('一覧のページが空なら（公式の作りが変わった）ValidationFailed', async () => {
    const site = fakeSite({ all: [] });
    await expect(
      runScrape({ mode: 'incremental', fetcher: site.fetcher, now: () => 0, paths, maxMinutes: 330 }),
    ).rejects.toBeInstanceOf(ValidationFailed);
  });

  test('limit と maxListPages で開発用に少しだけ読める', async () => {
    const site = fakeSite({ all: ['a-1', 'a-2', 'a-3', 'a-4', 'a-5'] });
    await runScrape({ mode: 'incremental', fetcher: site.fetcher, now: () => 0, paths, maxMinutes: 330, maxListPages: 1, limit: 1 });
    expect(site.calls.details).toEqual(['a-1']);
    expect(readCards().map((c) => c.id)).toEqual(['a-1']);
  });
});
