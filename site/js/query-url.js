import { defaultQuery } from './filter.js';

const CIVS = ['光', '水', '闇', '火', '自然', 'ゼロ'];
const ENUMS = {
  civMode: ['any', 'only', 'all'],
  colorCount: ['any', 'mono', 'multi'],
  twinpactMode: ['any', 'only', 'exclude'],
  sort: ['release', 'name', 'cost', 'power'],
  order: ['asc', 'desc'],
};
const NUMS = ['costMin', 'costMax', 'powerMin', 'powerMax'];
const LISTS = { civs: 'civ', types: 'type', races: 'race', rarities: 'rarity', products: 'product', formats: 'format', keywords: 'kw' };
const FORMATS = ['original', 'current'];

/** 初期値と違う項目だけを `#key=value&...` にする。配列は同じキーを繰り返す。 */
export function queryToHash(q) {
  const d = defaultQuery();
  const p = new URLSearchParams();
  if (q.text) p.set('q', q.text);
  for (const [field, key] of Object.entries(LISTS)) for (const v of q[field]) p.append(key, v);
  for (const k of Object.keys(ENUMS)) if (q[k] !== d[k]) p.set(k, q[k]);
  for (const k of NUMS) if (q[k] != null) p.set(k, String(q[k]));
  if (q.illustrator) p.set('illust', q.illustrator);
  if (q.groupSameName !== d.groupSameName) p.set('group', q.groupSameName ? '1' : '0');
  if (q.density !== d.density) p.set('density', String(q.density));
  const s = p.toString();
  return s ? `#${s}` : '';
}

/** ハッシュから Query を作る。読めない値は初期値のままにする。 */
export function hashToQuery(hash) {
  const q = defaultQuery();
  let p;
  try {
    p = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  } catch {
    return q;
  }
  q.text = p.get('q') ?? '';
  for (const [field, key] of Object.entries(LISTS)) q[field] = p.getAll(key).filter(Boolean);
  q.civs = q.civs.filter((c) => CIVS.includes(c));
  q.formats = q.formats.filter((f) => FORMATS.includes(f));
  for (const [k, allowed] of Object.entries(ENUMS)) {
    const v = p.get(k);
    if (v && allowed.includes(v)) q[k] = v;
  }
  for (const k of NUMS) {
    const v = p.get(k);
    if (v != null && /^\d+$/.test(v)) q[k] = Number(v);
  }
  q.illustrator = p.get('illust') ?? '';
  const g = p.get('group');
  if (g === '0' || g === '1') q.groupSameName = g === '1';
  const dens = Number(p.get('density'));
  if ([1, 2, 3].includes(dens)) q.density = dens;
  return q;
}
