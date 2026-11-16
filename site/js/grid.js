import { renderTile } from './card-tile.js';

const TILE_WIDTH = { 1: 72, 2: 96, 3: 128 };
const GAP = 6;
const CAPTION = 18; // カード名1行の高さ
const OVERSCAN_ROWS = 2;

/**
 * 画面に見えている行（と前後2行）だけを描く一覧。
 * container 自体がスクロールする要素であること。
 * @param {HTMLElement} container
 * @param {{ onSelect: (card: object) => void }} opts
 */
export function createGrid(container, { onSelect }) {
  container.classList.add('grid');
  const spacer = document.createElement('div');
  spacer.className = 'grid__spacer';
  container.append(spacer);

  let cards = [];
  let density = 2;
  let cols = 1;
  let tileW = TILE_WIDTH[2];
  let rowH = 0;
  let rendered = new Map(); // rowIndex -> row element
  let selectedId = null;
  let frame = 0;

  function layout() {
    const width = container.clientWidth - GAP;
    const base = TILE_WIDTH[density];
    cols = Math.max(1, Math.floor((width + GAP) / (base + GAP)));
    tileW = Math.floor((width - GAP * (cols - 1)) / cols); // 余りを均等に配る
    rowH = Math.round((tileW * 88) / 63) + CAPTION + GAP;
    container.style.setProperty('--tile-w', `${tileW}px`);
    container.style.setProperty('--tile-cols', String(cols));
    spacer.style.height = `${Math.ceil(cards.length / cols) * rowH + GAP}px`;
    for (const row of rendered.values()) row.remove();
    rendered = new Map();
    draw();
  }

  function buildRow(r) {
    const row = document.createElement('div');
    row.className = 'grid__row';
    row.style.transform = `translateY(${r * rowH + GAP}px)`;
    row.style.height = `${rowH - GAP}px`;
    for (let i = r * cols; i < Math.min(cards.length, (r + 1) * cols); i++) {
      const tile = renderTile(cards[i]);
      if (cards[i].id === selectedId) tile.classList.add('is-selected');
      row.append(tile);
    }
    return row;
  }

  function draw() {
    frame = 0;
    if (!rowH) return;
    const rows = Math.ceil(cards.length / cols);
    const first = Math.max(0, Math.floor(container.scrollTop / rowH) - OVERSCAN_ROWS);
    const last = Math.min(rows - 1, Math.ceil((container.scrollTop + container.clientHeight) / rowH) + OVERSCAN_ROWS);
    for (const [r, row] of rendered) {
      if (r < first || r > last) { row.remove(); rendered.delete(r); }
    }
    for (let r = first; r <= last; r++) {
      if (!rendered.has(r)) {
        const row = buildRow(r);
        rendered.set(r, row);
        spacer.append(row);
      }
    }
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
  container.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(() => layout()).observe(container);

  spacer.addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    const card = cards.find((c) => c.id === tile.dataset.id);
    if (!card) return;
    selectedId = card.id;
    spacer.querySelectorAll('.tile.is-selected').forEach((t) => t.classList.remove('is-selected'));
    tile.classList.add('is-selected');
    onSelect(card);
  });

  return {
    setCards(next) {
      cards = next;
      container.scrollTop = 0;
      layout();
    },
    setDensity(d) {
      density = d;
      layout();
    },
    clearSelection() {
      selectedId = null;
      spacer.querySelectorAll('.tile.is-selected').forEach((t) => t.classList.remove('is-selected'));
    },
  };
}
