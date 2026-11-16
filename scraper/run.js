import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL, MAX_RUN_MINUTES, assertConfigured } from './config.js';
import { createFetcher, FetchError } from './fetcher.js';
import { listPageRequest, parseListPage, parseFilterOptions, parseRightsNotice } from './parse-list.js';
import { parseDetailPage } from './parse-detail.js';
import { validateCard } from './validate.js';
import { loadState, saveState } from './state.js';

const DAY = 24 * 60 * 60 * 1000;
const FULL_EVERY_DAYS = 30;
const INCREMENTAL_EVERY_DAYS = 7;
const FORMATS = ['original', 'current'];

export class ValidationFailed extends Error {
  constructor(errors) {
    super(`カードデータの点検で ${errors.length} 件の問題が見つかりました:\n${errors.slice(0, 50).join('\n')}`);
    this.errors = errors;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}
const readJson = (file, fallback) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback);

/** 一覧ページを最後まで（または maxListPages まで）読む。 */
async function collectList(fetcher, filters, maxListPages) {
  const items = [];
  let firstHtml = null;
  for (let page = 1; ; page++) {
    const req = listPageRequest(page, filters);
    const html = await fetcher.post(req.url, req.body);
    if (page === 1) firstHtml = html;
    const r = parseListPage(html);
    items.push(...r.items);
    if (!r.hasNext || page >= maxListPages) break;
  }
  return { items, firstHtml };
}

/** 全体の一覧とフォーマット別の一覧を読む。 */
async function snapshotLists(fetcher, maxListPages) {
  const { items, firstHtml } = await collectList(fetcher, {}, maxListPages);
  if (items.length === 0) throw new ValidationFailed(['一覧ページからカードが1件も取れませんでした（公式サイトの作りが変わった可能性があります）']);
  const formats = {};
  for (const f of FORMATS) {
    formats[f] = (await collectList(fetcher, { format: f }, maxListPages)).items.map((i) => i.id);
  }
  return {
    items,
    formats,
    rightsNotice: parseRightsNotice(firstHtml),
    options: parseFilterOptions(firstHtml),
  };
}

async function fetchCard(fetcher, id, thumb) {
  let html;
  try {
    html = await fetcher.get(`${BASE_URL}/card/detail/?id=${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof FetchError && e.status === 404) return { skipped: true };
    throw e;
  }
  try {
    const card = parseDetailPage(html, id);
    card.thumb = thumb;
    return { card, errors: validateCard(card) };
  } catch (e) {
    return { errors: [`${id}: ${e.message}`] };
  }
}

/** 一覧の並び（新しい順）とフォーマットを付けて、書き出す。 */
function finalize(snapshot, byId, paths, nowIso) {
  const fmtSets = Object.fromEntries(FORMATS.map((f) => [f, new Set(snapshot.formats[f])]));
  const n = snapshot.items.length;
  const cards = [];
  snapshot.items.forEach((item, i) => {
    const c = byId.get(item.id);
    if (!c) return;
    cards.push({
      ...c,
      thumb: item.thumb,
      releaseOrder: n - i,
      formats: FORMATS.filter((f) => fmtSets[f].has(item.id)),
    });
  });
  writeJson(paths.cards, cards);
  writeJson(paths.meta, {
    updatedAt: nowIso,
    count: cards.length,
    rightsNotice: snapshot.rightsNotice,
    options: snapshot.options,
  });
}

async function runIncremental(o) {
  const snapshot = await snapshotLists(o.fetcher, o.maxListPages);
  const existing = new Map(readJson(o.paths.cards, []).map((c) => [c.id, c]));
  const errors = [];
  let fetched = 0;
  for (const item of snapshot.items) {
    if (existing.has(item.id)) continue;
    if (fetched >= o.limit) break;
    fetched++;
    const r = await fetchCard(o.fetcher, item.id, item.thumb);
    if (r.card) existing.set(item.id, r.card);
    errors.push(...(r.errors ?? []));
  }
  if (errors.length) throw new ValidationFailed(errors);
  finalize(snapshot, existing, o.paths, o.nowIso());
  const state = loadState(o.paths.state);
  state.lastIncrementalAt = o.nowIso();
  saveState(o.paths.state, state);
  return { action: 'incremental', written: true };
}

async function runFull(o) {
  const state = loadState(o.paths.state);
  let cache = readJson(o.paths.cache, null);
  if (!state.full || !cache) {
    const snapshot = await snapshotLists(o.fetcher, o.maxListPages);
    const ids = snapshot.items.map((i) => i.id).slice(0, o.limit);
    cache = { snapshot, cards: {} };
    state.full = { startedAt: o.nowIso(), pendingIds: ids, doneIds: [] };
    writeJson(o.paths.cache, cache);
    saveState(o.paths.state, state);
  }
  const thumbs = new Map(cache.snapshot.items.map((i) => [i.id, i.thumb]));
  const errors = [];
  let sinceSave = 0;
  const persist = () => { writeJson(o.paths.cache, cache); saveState(o.paths.state, state); };

  while (state.full.pendingIds.length) {
    if (o.now() - o.startedAt >= o.maxMinutes * 60 * 1000) {
      persist();
      return { action: 'full-progress', written: false };
    }
    const id = state.full.pendingIds[0];
    const r = await fetchCard(o.fetcher, id, thumbs.get(id));
    if (r.errors?.length) errors.push(...r.errors);
    if (r.card) cache.cards[id] = r.card;
    state.full.pendingIds.shift();
    state.full.doneIds.push(id);
    if (errors.length) break;
    if (++sinceSave >= 50) { persist(); sinceSave = 0; }
  }
  if (errors.length) {
    persist();
    throw new ValidationFailed(errors);
  }
  finalize(cache.snapshot, new Map(Object.entries(cache.cards)), o.paths, o.nowIso());
  state.full = null;
  state.lastFullAt = o.nowIso();
  state.lastIncrementalAt = o.nowIso();
  saveState(o.paths.state, state);
  fs.rmSync(o.paths.cache, { force: true });
  return { action: 'full-done', written: true };
}

/**
 * @param {{ mode: 'auto'|'incremental'|'full', fetcher: {get, post}, now: () => number,
 *   paths: {cards, meta, state, cache}, maxMinutes: number, maxListPages?: number, limit?: number }} opts
 */
export async function runScrape({ mode, fetcher, now, paths, maxMinutes, maxListPages = Infinity, limit = Infinity }) {
  const o = { fetcher, now, paths, maxMinutes, maxListPages, limit, startedAt: now(), nowIso: () => new Date(now()).toISOString() };
  if (mode === 'incremental') return runIncremental(o);
  if (mode === 'full') return runFull(o);

  const state = loadState(paths.state);
  const since = (iso) => (iso ? o.startedAt - Date.parse(iso) : Infinity);
  if (state.full || since(state.lastFullAt) >= FULL_EVERY_DAYS * DAY) return runFull(o);
  if (since(state.lastIncrementalAt) >= INCREMENTAL_EVERY_DAYS * DAY) return runIncremental(o);
  return { action: 'none', written: false };
}

// ---- コマンドとして実行したとき ----
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => { const [k, v = 'true'] = a.replace(/^--/, '').split('='); return [k, v]; }),
  );
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dev = args.dev === 'true';
  try {
    if (!dev) assertConfigured();
    const fetcher = createFetcher(dev ? { userAgent: 'DMCardViewer/1.0 (development)' } : {});
    const result = await runScrape({
      mode: args.mode ?? 'auto',
      fetcher,
      now: () => Date.now(),
      paths: {
        cards: path.join(root, 'site/data/cards.json'),
        meta: path.join(root, 'site/data/meta.json'),
        state: path.join(root, 'scraper/state.json'),
        cache: path.join(root, 'scraper/.cache/full.json'),
      },
      maxMinutes: Number(args['max-minutes'] ?? MAX_RUN_MINUTES),
      maxListPages: args['max-list-pages'] ? Number(args['max-list-pages']) : Infinity,
      limit: args.limit ? Number(args.limit) : Infinity,
    });
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
