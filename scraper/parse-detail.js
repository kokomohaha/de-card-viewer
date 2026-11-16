import * as cheerio from 'cheerio';

/** 全角数字を半角にし、先頭の数字を取り出す。数字がなければ null。 */
export function toNumberOrNull(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).trim();
  const m = s.match(/^-?\d+/);
  return m ? Number(m[0]) : null;
}

const orNull = (s) => (s === '' || s === '-' ? null : s);
const splitSlash = (s) => (s ? s.split('/').map((x) => x.trim()).filter(Boolean) : []);

function cellText($, box, cls) {
  const td = box.find(`td.${cls}`).first();
  if (!td.length) return '';
  td.find('br').replaceWith('\n');
  return td.text().replace(/[ \t\r]+/g, ' ').replace(/\n\s*/g, '\n').trim();
}

function headingName($, box) {
  const h = box.find('h3.card-name').first().clone();
  h.find('.packname').remove();
  return h.text().replace(/\s+/g, ' ').trim();
}

function parseFace($, box, name) {
  const powerRaw = orNull(cellText($, box, 'power'));
  const costRaw = orNull(cellText($, box, 'cost'));
  return {
    name,
    reading: null,
    type: cellText($, box, 'type'),
    civilizations: splitSlash(cellText($, box, 'civil')),
    cost: toNumberOrNull(costRaw),
    costRaw,
    power: toNumberOrNull(powerRaw),
    powerRaw,
    mana: toNumberOrNull(orNull(cellText($, box, 'mana'))),
    races: splitSlash(cellText($, box, 'race')),
    abilities: cellText($, box, 'skills'),
    flavor: cellText($, box, 'flavor'),
  };
}

/**
 * 公式の詳細ページから Card を作る。formats と releaseOrder は呼び出し側で付ける。
 * @param {string} html
 * @param {string} id
 */
export function parseDetailPage(html, id) {
  const $ = cheerio.load(html);
  const boxes = $('.cardDetail').toArray().map((b) => $(b));
  if (!boxes.length) throw new Error(`カード情報が見つかりません: ${id}`);

  const firstHeading = headingName($, boxes[0]);
  const secondImage = boxes[1]?.find('.card-img img').attr('src');
  const isTwinpact = boxes.length > 1 && !secondImage;

  let names = [firstHeading];
  if (isTwinpact) {
    names = firstHeading.split(' / ').map((s) => s.trim());
  } else if (boxes[1]) {
    names = [firstHeading, headingName($, boxes[1])];
  }

  const front = parseFace($, boxes[0], names[0]);
  const second = boxes[1] ? { ...parseFace($, boxes[1], names[1] ?? ''), image: secondImage || null } : null;
  // 見出しの「(DMR14 51/55)」から収録商品の記号と番号を取り出す
  const pack = boxes[0].find('h3.card-name .packname').first().text().replace(/[()（）]/g, '').trim();
  const [setCode = null, ...rest] = pack.split(/\s+/);
  const number = rest.join(' ') || null;
  const products = $('.productCardList li a')
    .map((_, a) => $(a).text().replace(/\s+/g, ' ').trim())
    .get();

  return {
    id,
    ...front,
    rarity: cellText($, boxes[0], 'rarelity'),
    illustrator: cellText($, boxes[0], 'illusttxt'),
    image: boxes[0].find('.card-img img').attr('src') || null,
    thumb: null,
    setCode,
    number,
    products,
    formats: [],
    releaseOrder: 0,
    second,
    isTwinpact,
  };
}
