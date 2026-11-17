import { filterCards } from './filter.js';
import { queryToHash, hashToQuery } from './query-url.js';
import { createGrid } from './grid.js';
import { createDetail } from './detail.js';
import { createControls } from './controls.js';
import { useNormalImages } from './normal.js';
import { loadCards } from './load-cards.js';

// 公開前に、専用 Gmail アドレスに書き換えてください（削除依頼などの窓口としてフッターに表示します）。
const CONTACT_EMAIL = 'fengjinyg87@gmail.com';

const $ = (id) => document.getElementById(id);

async function loadJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function renderFooter(meta) {
  $('rights').textContent = meta.rightsNotice ?? '';
  if (meta.updatedAt) {
    const d = new Date(meta.updatedAt);
    $('updated').textContent = `データ更新日：${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  if (!CONTACT_EMAIL.startsWith('TODO')) $('contact').textContent = `　お問い合わせ・削除依頼：${CONTACT_EMAIL}`;
}

async function main() {
  const gridEl = $('grid');
  let cards;
  let meta;
  try {
    meta = await loadJson('data/meta.json');
    cards = await loadCards(meta, loadJson);
  } catch {
    $('status').textContent = 'カードデータを読み込めませんでした。時間をおいて再読み込みしてください。';
    return;
  }
  $('status').remove();
  cards = useNormalImages(cards); // 画像はすべて通常版のものを使う
  renderFooter(meta);

  const grid = createGrid(gridEl, { onSelect: (card) => detail.show(card) });
  const detail = createDetail($('detail'), { onClose: () => grid.clearSelection() });

  let lastDensity = null;
  function apply(q, { updateHash = true } = {}) {
    const result = filterCards(cards, q);
    if (q.density !== lastDensity) { grid.setDensity(q.density); lastDensity = q.density; }
    grid.setCards(result);
    $('count').textContent = `${result.length.toLocaleString()} 枚`;
    $('count-mobile').textContent = `${result.length.toLocaleString()} 枚`;
    if (updateHash) {
      const h = queryToHash(q);
      if (h !== location.hash) history.replaceState(null, '', h || location.pathname + location.search);
    }
  }

  const controls = createControls(meta, (q) => apply(q));
  $('f-toggle').addEventListener('click', () => {
    const open = $('filters').classList.toggle('is-open');
    $('f-toggle').setAttribute('aria-expanded', String(open));
  });
  const fromHash = () => {
    const q = hashToQuery(location.hash);
    controls.write(q);
    apply(q, { updateHash: false });
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

main();
