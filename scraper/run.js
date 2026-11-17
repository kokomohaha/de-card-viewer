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


// 読み取れないカード（404・解析できない・必須項目がない）は飛ばして続ける。
// ただし50件を超えるか、全体の5%を超えたら、公式の作りが変わった疑いがあるので止める。
const MAX_PROBLEMS = 50;
const MAX_PROBLEM_RATIO = 0.05;
const MIN_KEEP_RATIO = 0.95; // 前回より5%以上減ったら公開しない
const PAGE_MARGIN = 5;

/**
 * 一覧ページを最後まで（または maxListPages まで）読む。
 * ページ送りが効いていない・同じ内容が繰り返される・終わらないときはすぐ止める。
 */
async function collectList(fetcher, filters, maxListPages) {
  const items = [];
  const seen = new Set();
  let firstHtml = null;
  let firstLast = null;
  for (let page = 1; ; page++) {
    const req = listPageRequest(page, filters);
    const html = await fetcher.post(req.url, req.body);
    const r = parseListPage(html);
    if (page === 1) { firstHtml = html; firstLast = r.lastPage; }
    if (r.page !== page) {
      throw new ValidationFailed([`一覧の ${page} ページ目を頼んだのに ${r.page} ページ目が返りました（ページ送りの仕組みが変わった可能性があります）`]);
    }
    const fresh = r.items.filter((i) => !seen.has(i.id));
    if (page > 1 && r.items.length && !fresh.length) {
      throw new ValidationFailed([`一覧の ${page} ページ目が前のページと同じ内容でした`]);
    }
    for (const i of fresh) { seen.add(i.id); items.push(i); }
    if (!r.hasNext || page >= maxListPages) break;
    if (page >= firstLast + PAGE_MARGIN) {
      throw new ValidationFailed([`一覧が ${firstLast} ページのはずが終わりません`]);
    }
  }
  return { items, firstHtml };
}

/** 全体の一覧とフォーマット別の一覧を読む。 */
async function snapshotLists(o) {
  const { items, firstHtml } = await collectList(o.fetcher, {}, o.maxListPages);
  if (items.length === 0 || items.length < o.minCards) {
    throw new ValidationFailed([`一覧から ${items.length} 枚しか取れませんでした（公式サイトの作りが変わった可能性があります）`]);
  }
  const formats = {};
  for (const f of FORMATS) {
    formats[f] = (await collectList(o.fetcher, { format: f }, o.maxListPages)).items.map((i) => i.id);
  }
  return { items, formats, rightsNotice: parseRightsNotice(firstHtml), options: parseFilterOptions(firstHtml) };
}

async function fetchCard(fetcher, id, thumb) {
  let html;
  try {
    html = await fetcher.get(`${BASE_URL}/card/detail/?id=${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof FetchError && e.status === 404) return { skipped: true, errors: [] };
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

/** 1枚分の結果を problems に記録する。カードとして使えるなら返す。 */
function take(r, id, problems) {
  if (r.skipped) { problems.push(`${id}: 詳細ページが見つかりません（404）`); return null; }
  if (r.errors.length) { problems.push(...r.errors); return null; }
  return r.card;
}

function checkProblems(problems, attempted, { final }) {
  const tooMany = problems.length > MAX_PROBLEMS || (final && attempted > 0 && problems.length / attempted > MAX_PROBLEM_RATIO);
  if (tooMany) throw new ValidationFailed([`${attempted} 件中 ${problems.length} 件のカードを読み取れませんでした（公式サイトの作りが変わった可能性があります）`, ...problems]);
}

function reportProblems(problems) {
  if (problems.length) console.warn(`読み取れなかったため飛ばしたカード（${problems.length} 件）:\n${problems.join('\n')}`);
}

/** 一覧の並び（新しい順）とフォーマットを付けて、書き出す。前回より大きく減るときは書かない。 */
function finalize(snapshot, byId, paths, nowIso) {
  const fmtSets = Object.fromEntries(FORMATS.map((f) => [f, new Set(snapshot.formats[f])]));
  const n = snapshot.items.length;
  const cards = [];
  snapshot.items.forEach((item, i) => {
    const c = byId.get(item.id);
    if (!c) return;
    cards.push({ ...c, thumb: item.thumb, releaseOrder: n - i, formats: FORMATS.filter((f) => fmtSets[f].has(item.id)) });
  });
  const prevCount = readJson(paths.cards, []).length;
  if (cards.length === 0 || (prevCount >= 100 && cards.length < prevCount * MIN_KEEP_RATIO)) {
    throw new ValidationFailed([`カードが ${prevCount} 枚から ${cards.length} 枚に減ります（公式サイトの作りが変わった可能性があるため、公開しません）`]);
  }
  writeJson(paths.cards, cards);
  writeJson(paths.meta, { updatedAt: nowIso, count: cards.length, rightsNotice: snapshot.rightsNotice, options: snapshot.options });
}

async function runIncremental(o) {
  const snapshot = await snapshotLists(o);
  const existing = new Map(readJson(o.paths.cards, []).map((c) => [c.id, c]));
  const problems = [];
  let attempted = 0;
  for (const item of snapshot.items) {
    if (existing.has(item.id)) continue;
    if (attempted >= o.limit) break;
    attempted++;
    const card = take(await fetchCard(o.fetcher, item.id, item.thumb), item.id, problems);
    if (card) existing.set(item.id, card);
    checkProblems(problems, attempted, { final: false });
  }
  checkProblems(problems, attempted, { final: true });
  reportProblems(problems);
  finalize(snapshot, existing, o.paths, o.nowIso());
  const state = loadState(o.paths.state);
  state.lastIncrementalAt = o.nowIso();
  saveState(o.paths.state, state);
  return { action: 'incremental', written: true };
}

/**
 * 全件の読み直し。進み具合（一覧・読んだカード・残りのID）はすべて cache ファイル1つに入れる
 * （GitHub Actions のキャッシュで次回に引き継ぐ。git の state.json には完了日時だけを残す）。
 */
async function runFull(o) {
  let cache = readJson(o.paths.cache, null);
  if (cache?.done) return republish(o, cache);
  if (!cache) {
    const snapshot = await snapshotLists(o);
    cache = {
      startedAt: o.nowIso(),
      snapshot,
      cards: {},
      pendingIds: snapshot.items.map((i) => i.id).slice(0, o.limit),
      doneIds: [],
      problems: [],
      done: false,
    };
    writeJson(o.paths.cache, cache);
  }
  const thumbs = new Map(cache.snapshot.items.map((i) => [i.id, i.thumb]));
  cache.problems ??= [];
  let sinceSave = 0;
  try {
    while (cache.pendingIds.length) {
      if (o.now() - o.startedAt >= o.maxMinutes * 60 * 1000) return { action: 'full-progress', written: false };
      const id = cache.pendingIds[0];
      const card = take(await fetchCard(o.fetcher, id, thumbs.get(id)), id, cache.problems);
      if (card) cache.cards[id] = card;
      cache.pendingIds.shift();
      cache.doneIds.push(id);
      checkProblems(cache.problems, cache.doneIds.length, { final: false });
      if (++sinceSave >= 50) { writeJson(o.paths.cache, cache); sinceSave = 0; }
    }
  } finally {
    writeJson(o.paths.cache, cache);
  }
  checkProblems(cache.problems, cache.doneIds.length, { final: true });
  reportProblems(cache.problems);

  finalize(cache.snapshot, new Map(Object.entries(cache.cards)), o.paths, o.nowIso());
  cache.done = true;
  cache.completedAt = o.nowIso();
  writeJson(o.paths.cache, cache); // 公開（push）に成功したら workflow が消す
  const state = loadState(o.paths.state);
  state.full = null;
  state.lastFullAt = cache.completedAt;
  state.lastIncrementalAt = cache.completedAt;
  saveState(o.paths.state, state);
  return { action: 'full-done', written: true };
}

/** 全件の読み直しは終わったのに公開できなかった結果を、読み直さずにもう一度書き出す。 */
function republish(o, cache) {
  finalize(cache.snapshot, new Map(Object.entries(cache.cards)), o.paths, o.nowIso());
  const state = loadState(o.paths.state);
  state.full = null;
  state.lastFullAt = cache.completedAt;
  state.lastIncrementalAt = cache.completedAt;
  saveState(o.paths.state, state);
  return { action: 'full-done', written: true };
}

/**
 * @param {{ mode: 'auto'|'incremental'|'full', fetcher: {get, post}, now: () => number,
 *   paths: {cards, meta, state, cache}, maxMinutes: number, maxListPages?: number, limit?: number, minCards?: number }} opts
 */
export async function runScrape({ mode, fetcher, now, paths, maxMinutes, maxListPages = Infinity, limit = Infinity, minCards = 0 }) {
  const o = { fetcher, now, paths, maxMinutes, maxListPages, limit, minCards, startedAt: now(), nowIso: () => new Date(now()).toISOString() };
  if (mode === 'incremental') return runIncremental(o);
  if (mode === 'full') return runFull(o);

  const state = loadState(paths.state);
  const cache = readJson(paths.cache, null);
  if (cache?.done) {
    const published = state.lastFullAt && Date.parse(state.lastFullAt) >= Date.parse(cache.completedAt);
    if (!published) return republish(o, cache);
    fs.rmSync(paths.cache, { force: true });
  } else if (cache) {
    return runFull(o);
  }
  const since = (iso) => (iso ? o.startedAt - Date.parse(iso) : Infinity);
  if (since(state.lastFullAt) >= FULL_EVERY_DAYS * DAY) return runFull(o);
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
      // 本番では、約2万4千枚のはずの一覧が1000枚未満なら公開しない（開発用の部分読み取りは除く）
      minCards: args['max-list-pages'] || args.limit ? 0 : 1000,
    });
    console.log(JSON.stringify(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
