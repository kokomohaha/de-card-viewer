import * as cheerio from 'cheerio';
import { BASE_URL } from './config.js';

/**
 * 公式のカード一覧は POST /card/ でページを切り替える。
 * samename=show を付けないと同名カードがまとめられ、全部のカードが出ない。
 * @param {number} page
 * @param {{format?: 'original'|'current'}} [filters]
 */
export function listPageRequest(page, filters = {}) {
  const params = new URLSearchParams({ pagenum: String(page), samename: 'show' });
  if (filters.format) params.set('format', filters.format);
  return { url: `${BASE_URL}/card/`, body: params.toString() };
}

/** @returns {{ items: {id: string, thumb: string}[], page: number, lastPage: number, hasNext: boolean }} */
export function parseListPage(html) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();
  $('img.cardImage').each((_, img) => {
    const href = $(img).attr('data-href') || '';
    const m = href.match(/[?&]id=([^&]+)/);
    if (!m || seen.has(m[1])) return;
    seen.add(m[1]);
    items.push({ id: m[1], thumb: $(img).attr('src') });
  });
  const nav = $('.wp-pagenavi').first();
  const page = Number(nav.find('.current').first().text().trim()) || 1;
  const pages = nav.find('[data-page]').map((_, a) => Number($(a).attr('data-page'))).get();
  const lastPage = Math.max(page, ...pages);
  return { items, page, lastPage, hasNext: page < lastPage };
}

function optionTexts($, name) {
  return $(`[name="${name}"] option`)
    .map((_, o) => ({ value: $(o).attr('value'), text: $(o).text().trim() }))
    .get()
    .filter((o) => o.value !== '' && o.value !== undefined);
}

export function parseFilterOptions(html) {
  const $ = cheerio.load(html);
  const products = optionTexts($, 'products').map((o) => o.text);
  return {
    races: optionTexts($, 'race').map((o) => o.text),
    rarities: optionTexts($, 'rarity').map((o) => o.text),
    keywords: optionTexts($, 'ability').map((o) => o.text),
    types: optionTexts($, 'cardtype').map((o) => o.text),
    products: products.map((name, i) => ({ name, order: products.length - 1 - i })),
  };
}

export function parseRightsNotice(html) {
  const $ = cheerio.load(html);
  return $('.rowCopy p').first().text().replace(/\s+/g, ' ').trim();
}
