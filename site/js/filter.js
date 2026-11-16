/** @returns {import('./types.js').Query} */
export function defaultQuery() {
  return {
    text: '',
    civs: [],
    civMode: 'any',
    colorCount: 'any',
    costMin: null,
    costMax: null,
    powerMin: null,
    powerMax: null,
    types: [],
    races: [],
    rarities: [],
    products: [],
    formats: [],
    keywords: [],
    twinpactMode: 'any',
    illustrator: '',
    groupSameName: true,
    sort: 'release',
    order: 'desc',
    density: 2,
  };
}

/** 全角英数→半角、カタカナ→ひらがな、小文字にそろえる。 */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .toLowerCase();
}

const faces = (card) => (card.second ? [card, card.second] : [card]);

// 文字検索用の文字列はカードごとに1回だけ作る
const haystacks = new WeakMap();
function haystack(card) {
  let h = haystacks.get(card);
  if (h === undefined) {
    const parts = [card.illustrator];
    for (const f of faces(card)) parts.push(f.name, f.reading, f.abilities, f.flavor, ...(f.races ?? []));
    h = normalize(parts.filter(Boolean).join('\n'));
    haystacks.set(card, h);
  }
  return h;
}

function inRange(value, min, max) {
  if (min == null && max == null) return true;
  if (value == null) return false;
  return (min == null || value >= min) && (max == null || value <= max);
}

function faceMatches(f, q) {
  const civs = f.civilizations ?? [];
  if (q.civs.length) {
    if (q.civMode === 'any' && !q.civs.some((c) => civs.includes(c))) return false;
    if (q.civMode === 'only' && !(civs.length && civs.every((c) => q.civs.includes(c)))) return false;
    if (q.civMode === 'all' && !q.civs.every((c) => civs.includes(c))) return false;
  }
  if (q.colorCount === 'mono' && civs.length !== 1) return false;
  if (q.colorCount === 'multi' && civs.length < 2) return false;
  if (!inRange(f.cost, q.costMin, q.costMax)) return false;
  if (!inRange(f.power, q.powerMin, q.powerMax)) return false;
  if (q.types.length && !q.types.some((t) => (f.type ?? '').includes(t))) return false;
  if (q.races.length && !q.races.some((r) => (f.races ?? []).includes(r))) return false;
  if (q.keywords.length && !q.keywords.some((k) => (f.abilities ?? '').includes(k))) return false;
  return true;
}

export function matchesCard(card, q, terms = splitTerms(q.text)) {
  if (q.twinpactMode === 'only' && !card.isTwinpact) return false;
  if (q.twinpactMode === 'exclude' && card.isTwinpact) return false;
  if (q.rarities.length && !q.rarities.includes(card.rarity)) return false;
  if (q.formats.length && !q.formats.some((f) => (card.formats ?? []).includes(f))) return false;
  if (q.products.length && !q.products.some((p) => (card.products ?? []).includes(p))) return false;
  if (q.illustrator && !normalize(card.illustrator).includes(normalize(q.illustrator))) return false;
  if (terms.length) {
    const h = haystack(card);
    if (!terms.every((t) => h.includes(t))) return false;
  }
  return faces(card).some((f) => faceMatches(f, q));
}

const splitTerms = (text) => normalize(text).split(/\s+/).filter(Boolean);

const collator = new Intl.Collator('ja');
const KEY = {
  release: (c) => c.releaseOrder,
  cost: (c) => c.cost,
  power: (c) => c.power,
};

export function sortCards(cards, sort, order) {
  const dir = order === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) => {
    let d;
    if (sort === 'name') {
      d = collator.compare(a.name, b.name) * dir;
    } else {
      const ka = KEY[sort](a);
      const kb = KEY[sort](b);
      if (ka == null && kb == null) d = 0;
      else if (ka == null) return 1;
      else if (kb == null) return -1;
      else d = (ka - kb) * dir;
    }
    return d || (b.releaseOrder ?? 0) - (a.releaseOrder ?? 0);
  });
}

/** 同じ名前のカードは releaseOrder が一番大きい（新しい）1枚だけ残す。 */
export function groupSameName(cards) {
  const best = new Map();
  for (const c of cards) {
    const cur = best.get(c.name);
    if (!cur || (c.releaseOrder ?? 0) > (cur.releaseOrder ?? 0)) best.set(c.name, c);
  }
  return [...best.values()];
}

export function filterCards(cards, q) {
  const terms = splitTerms(q.text);
  let out = cards.filter((c) => matchesCard(c, q, terms));
  if (q.groupSameName) out = groupSameName(out);
  return sortCards(out, q.sort, q.order);
}
