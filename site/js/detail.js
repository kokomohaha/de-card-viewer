import { buildLinks, imageUrl, thumbUrl } from './links.js';

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

/** 画像を画面いっぱいに表示する。押すか Esc で閉じる。 */
function openLightbox(src, alt) {
  closeLightbox();
  const img = el('img', { src, alt });
  const box = el('div', { class: 'lightbox', role: 'dialog', 'aria-label': `${alt} の拡大画像`, tabindex: '-1' }, img,
    el('span', { class: 'lightbox__hint' }, 'タップ／クリックで閉じる'));
  box.addEventListener('click', closeLightbox);
  document.body.append(box);
  box.focus({ preventScroll: true });
}
function closeLightbox() {
  const box = document.querySelector('.lightbox');
  if (!box) return false;
  box.remove();
  return true;
}

/**
 * カードの拡大画像。一覧で読み込み済みの画像をすぐ出し、詳細用の画像が届いたら差し替える。
 * 押すと全画面で表示する。
 */
function media(card, onFail) {
  const full = imageUrl(card);
  const first = thumbUrl(card);
  if (!first) return null;
  const img = el('img', { src: first, alt: card.name, decoding: 'async' });
  const zoom = el('button', { class: 'detail__zoom', type: 'button', title: '画面いっぱいに拡大' }, img);
  const box = el('div', { class: 'detail__media' }, zoom);
  img.addEventListener('error', () => { box.remove(); onFail(); });
  if (full && full !== first) {
    const pre = new Image();
    pre.addEventListener('load', () => { if (img.isConnected) img.src = full; });
    pre.src = full;
  }
  zoom.addEventListener('click', () => openLightbox(full ?? first, card.name));
  return box;
}

/** 詳細パネル。PC は右側（画像と情報の2列）、スマホは下から出る（CSS で切り替え）。 */
export function createDetail(aside, { onClose }) {
  function hide() {
    closeLightbox();
    aside.hidden = true;
    aside.classList.remove('has-image');
    aside.replaceChildren();
    onClose?.();
  }

  function show(card) {
    const close = el('button', { class: 'detail__close', type: 'button', 'aria-label': '詳細を閉じる' }, '×');
    close.addEventListener('click', hide);

    const mediaBox = media(card, () => aside.classList.remove('has-image'));

    const title = card.second && card.isTwinpact ? `${card.name} / ${card.second.name}` : card.name;
    const links = el('div', { class: 'links' });
    const l = buildLinks(card);
    for (const [k, label] of LINKS) {
      links.append(el('a', { href: l[k], target: '_blank', rel: 'noopener noreferrer' }, label));
    }

    const info = el('div', { class: 'detail__info' }, el('h2', {}, title), faceBlock(card, card));
    if (card.second) {
      info.append(el('h3', {}, card.isTwinpact ? `ツインパクト：${card.second.name}` : `裏面：${card.second.name}`), faceBlock(card.second));
    }
    info.append(links);
    if (card.products?.length) {
      info.append(el('h3', {}, '収録商品'), el('ul', { class: 'products' }, ...card.products.map((p) => el('li', {}, p))));
    }
    aside.replaceChildren(...[close, mediaBox, info].filter(Boolean));
    aside.classList.toggle('has-image', Boolean(mediaBox));
    aside.hidden = false;
    aside.scrollTop = 0;
    info.scrollTop = 0;
    close.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeLightbox()) { e.stopImmediatePropagation(); return; } // 1回の Esc では拡大表示だけを閉じる
    if (!aside.hidden && aside.isConnected) hide();
  });

  return { show, hide };
}
