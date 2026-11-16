import { defaultQuery } from './filter.js';

const $ = (id) => document.getElementById(id);
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

function fillSelect(select, values) {
  for (const v of values) select.append(new Option(v, v));
}
function fillDatalist(list, values) {
  list.replaceChildren(...values.map((v) => new Option(v)));
}

/**
 * 絞り込みの入力欄。入力が変わるたびに onChange(query) を呼ぶ（150ms 待ってから）。
 * @param {{ options: { races: string[], rarities: string[], products: {name: string}[], keywords: string[], types: string[] } }} meta
 */
export function createControls(meta, onChange) {
  const o = meta.options ?? {};
  fillSelect($('f-type'), o.types ?? []);
  fillSelect($('f-rarity'), o.rarities ?? []);
  fillDatalist($('dl-race'), o.races ?? []);
  fillDatalist($('dl-product'), (o.products ?? []).map((p) => p.name));
  fillDatalist($('dl-keyword'), o.keywords ?? []);
  const known = {
    race: new Set(o.races ?? []),
    product: new Set((o.products ?? []).map((p) => p.name)),
    keyword: new Set(o.keywords ?? []),
  };

  let density = 2;
  const civButtons = [...document.querySelectorAll('.civ')];
  const densityButtons = [...document.querySelectorAll('[data-density]')];

  // 一覧から選ぶ欄は、一覧にある値のときだけ絞り込みに使う（打ちかけで0件にならないように）
  const pick = (id, set) => {
    const v = $(id).value.trim();
    return v && set.has(v) ? [v] : [];
  };

  function read() {
    const [sort, order] = $('f-sort').value.split(':');
    return {
      ...defaultQuery(),
      text: $('f-text').value.trim(),
      civs: civButtons.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.civ),
      civMode: $('f-civmode').value,
      colorCount: $('f-color').value,
      costMin: num($('f-cost-min').value),
      costMax: num($('f-cost-max').value),
      powerMin: num($('f-power-min').value),
      powerMax: num($('f-power-max').value),
      types: $('f-type').value ? [$('f-type').value] : [],
      races: pick('f-race', known.race),
      rarities: $('f-rarity').value ? [$('f-rarity').value] : [],
      products: pick('f-product', known.product),
      formats: $('f-format').value ? [$('f-format').value] : [],
      keywords: pick('f-keyword', known.keyword),
      twinpactMode: $('f-twinpact').value,
      illustrator: $('f-illust').value.trim(),
      groupSameName: $('f-group').checked,
      sort,
      order,
      density,
    };
  }

  function write(q) {
    $('f-text').value = q.text;
    for (const b of civButtons) b.setAttribute('aria-pressed', String(q.civs.includes(b.dataset.civ)));
    $('f-civmode').value = q.civMode;
    $('f-color').value = q.colorCount;
    $('f-cost-min').value = q.costMin ?? '';
    $('f-cost-max').value = q.costMax ?? '';
    $('f-power-min').value = q.powerMin ?? '';
    $('f-power-max').value = q.powerMax ?? '';
    $('f-type').value = q.types[0] ?? '';
    $('f-race').value = q.races[0] ?? '';
    $('f-rarity').value = q.rarities[0] ?? '';
    $('f-product').value = q.products[0] ?? '';
    $('f-format').value = q.formats[0] ?? '';
    $('f-keyword').value = q.keywords[0] ?? '';
    $('f-twinpact').value = q.twinpactMode;
    $('f-illust').value = q.illustrator;
    $('f-group').checked = q.groupSameName;
    const sortValue = `${q.sort}:${q.order}`;
    $('f-sort').value = [...$('f-sort').options].some((op) => op.value === sortValue) ? sortValue : 'release:desc';
    density = q.density;
    for (const b of densityButtons) b.setAttribute('aria-pressed', String(Number(b.dataset.density) === density));
    if (q.civMode !== 'any' || q.colorCount !== 'any' || q.rarities.length || q.powerMin != null || q.powerMax != null ||
        q.twinpactMode !== 'any' || q.formats.length || q.keywords.length || q.illustrator) {
      document.querySelector('.more').open = true;
    }
  }

  let timer = 0;
  const changed = () => {
    clearTimeout(timer);
    timer = setTimeout(() => onChange(read()), 150);
  };

  const form = $('filters');
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  for (const b of civButtons) {
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
      changed();
    });
  }
  for (const b of densityButtons) {
    b.addEventListener('click', () => {
      density = Number(b.dataset.density);
      for (const x of densityButtons) x.setAttribute('aria-pressed', String(x === b));
      onChange(read());
    });
  }
  $('f-reset').addEventListener('click', () => {
    write({ ...defaultQuery(), density });
    onChange(read());
  });

  return { read, write };
}
