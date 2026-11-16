import { buildLinks, imageUrl } from './links.js';

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

function facts(f, card) {
  const rows = [
    ['文明', (f.civilizations ?? []).join(' / ')],
    ['コスト', f.costRaw ?? f.cost],
    ['パワー', f.powerRaw],
    ['マナ', f.mana],
    ['種類', f.type],
    ['種族', (f.races ?? []).join(' / ')],
  ];
  if (card) rows.push(['レアリティ', card.rarity], ['イラスト', card.illustrator]);
  const dl = el('dl', { class: 'facts' });
  for (const [k, v] of rows) {
    if (v == null || v === '') continue;
    dl.append(el('dt', {}, k), el('dd', {}, String(v)));
  }
  return dl;
}

function faceBlock(f, card) {
  const frag = document.createDocumentFragment();
  frag.append(facts(f, card));
  if (f.abilities) frag.append(el('p', { class: 'ability' }, f.abilities));
  if (f.flavor) frag.append(el('p', { class: 'flavor' }, f.flavor));
  return frag;
}

const LINKS = [
  ['official', '公式の詳細ページ'],
  ['mercari', 'メルカリ（販売中・安い順）'],
  ['kanabellSell', 'カーナベルで買う'],
  ['kanabellBuy', 'カーナベルの買取価格'],
  ['youtube', 'YouTube で動画を探す'],
];

/** 詳細パネル。PC は右側、スマホは下から出る（CSS で切り替え）。 */
export function createDetail(aside, { onClose }) {
  function hide() {
    aside.hidden = true;
    aside.replaceChildren();
    onClose?.();
  }

  function show(card) {
    const close = el('button', { class: 'detail__close', type: 'button', 'aria-label': '詳細を閉じる' }, '×');
    close.addEventListener('click', hide);

    const src = imageUrl(card);
    const img = src ? el('img', { class: 'detail__img', src, alt: card.name, decoding: 'async' }) : null;
    img?.addEventListener('error', () => img.remove());

    const title = card.second && card.isTwinpact ? `${card.name} / ${card.second.name}` : card.name;
    const links = el('div', { class: 'links' });
    const l = buildLinks(card);
    for (const [k, label] of LINKS) {
      links.append(el('a', { href: l[k], target: '_blank', rel: 'noopener noreferrer' }, label));
    }

    const parts = [close, img, el('h2', {}, title), faceBlock(card, card)];
    if (card.second) {
      parts.push(el('h3', {}, card.isTwinpact ? `ツインパクト：${card.second.name}` : `裏面：${card.second.name}`), faceBlock(card.second));
    }
    parts.push(links);
    if (card.products?.length) {
      parts.push(el('h3', {}, '収録商品'), el('ul', { class: 'products' }, ...card.products.map((p) => el('li', {}, p))));
    }
    aside.replaceChildren(...parts.filter(Boolean));
    aside.hidden = false;
    aside.scrollTop = 0;
    close.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !aside.hidden) hide();
  });

  return { show, hide };
}
