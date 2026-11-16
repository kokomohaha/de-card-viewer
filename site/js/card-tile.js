import { thumbUrl } from './links.js';

export const CIV_VAR = {
  光: '--civ-light',
  水: '--civ-water',
  闇: '--civ-dark',
  火: '--civ-fire',
  自然: '--civ-nature',
  ゼロ: '--civ-zero',
};

/** 文明の色の帯（多色は縦に色を分ける）。 */
export function civBackground(civs) {
  const colors = (civs?.length ? civs : ['ゼロ']).map((c) => `var(${CIV_VAR[c] ?? '--civ-zero'})`);
  if (colors.length === 1) return `background: ${colors[0]}`;
  const step = 100 / colors.length;
  const stops = colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ');
  return `background: linear-gradient(180deg, ${stops})`;
}

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

const costLabel = (f) => f.costRaw ?? (f.cost ?? '-');

function textCard(card) {
  const box = el('div', 'tile__text');
  for (const f of card.second ? [card, card.second] : [card]) {
    const row = el('div', 'tile__face');
    row.append(el('span', 'tile__cost', String(costLabel(f))), el('span', 'tile__name', f.name));
    const sub = [f.powerRaw, (f.races ?? []).join('/')].filter(Boolean).join(' ・ ');
    if (sub) row.append(el('span', 'tile__sub', sub));
    box.append(row);
  }
  return box;
}

/** 一覧の1枚。画像が読めないときは文字のカードに切り替える。 */
export function renderTile(card) {
  const b = el('button', 'tile');
  b.type = 'button';
  b.dataset.id = card.id;
  b.title = card.second ? `${card.name} / ${card.second.name}` : card.name;

  const band = el('span', 'tile__band');
  band.setAttribute('style', civBackground([...(card.civilizations ?? []), ...(card.second?.civilizations ?? [])].filter((c, i, a) => a.indexOf(c) === i)));
  const frame = el('div', 'tile__frame');
  frame.append(band, textCard(card));

  const src = thumbUrl(card);
  if (src) {
    const img = el('img', 'tile__img');
    img.setAttribute('src', src);
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('alt', card.name);
    img.addEventListener('error', () => {
      img.remove();
      b.classList.add('tile--text');
    });
    frame.append(img);
  } else {
    b.classList.add('tile--text');
  }

  const cap = el('div', 'tile__cap');
  cap.append(el('span', 'tile__cost', String(costLabel(card))), el('span', 'tile__name', card.name));
  b.append(frame, cap);
  return b;
}
