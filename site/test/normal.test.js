import { test, expect } from 'vitest';
import { isNormalNumber, useNormalImages } from '../js/normal.js';

const card = (id, o = {}) => ({
  id, name: 'ボルシャック・ドラゴン', number: '1/55', releaseOrder: 1,
  image: `/wp-content/card/cardimage/${id}.jpg`, thumb: `/wp-content/card/cardthumb/${id}.jpg`, second: null, ...o,
});

test('通常版の収録番号は「数字/数字」', () => {
  expect(isNormalNumber('51/55')).toBe(true);
  expect(isNormalNumber('2/5')).toBe(true);
  expect(isNormalNumber('㊙1超/㊙6')).toBe(false);
  expect(isNormalNumber('G3/G20')).toBe(false);
  expect(isNormalNumber('TR7/TR9')).toBe(false);
  expect(isNormalNumber('V1/V2')).toBe(false);
  expect(isNormalNumber(null)).toBe(false);
});

test('同じ名前のカードは、通常版のうち一番古いものの画像を使う', () => {
  const cards = [
    card('new-secret', { number: '㊙1超/㊙6', releaseOrder: 30 }),
    card('reprint', { number: '10/74', releaseOrder: 20 }),
    card('original', { number: '5/110', releaseOrder: 10 }),
    card('promo', { number: 'P3/Y1', releaseOrder: 5 }),
  ];
  const out = useNormalImages(cards);
  for (const c of out) {
    expect(c.image).toBe('/wp-content/card/cardimage/original.jpg');
    expect(c.thumb).toBe('/wp-content/card/cardthumb/original.jpg');
  }
  // 収録情報など、カード自体の情報はそのまま
  expect(out.map((c) => c.id)).toEqual(['new-secret', 'reprint', 'original', 'promo']);
  expect(out[0].number).toBe('㊙1超/㊙6');
});

test('通常版がなければ、一番古いものの画像を使う', () => {
  const out = useNormalImages([card('b', { number: 'V1/V2', releaseOrder: 9 }), card('a', { number: 'SP1/SP5', releaseOrder: 2 })]);
  expect(out.map((c) => c.image)).toEqual(['/wp-content/card/cardimage/a.jpg', '/wp-content/card/cardimage/a.jpg']);
});

test('裏面の画像も通常版のものを使う', () => {
  const back = (id) => ({ name: '裏', image: `/wp-content/card/cardimage/${id}b.jpg` });
  const out = useNormalImages([
    card('sp', { name: '表', number: '超1/超5', releaseOrder: 9, second: back('sp') }),
    card('nm', { name: '表', number: '3/55', releaseOrder: 3, second: back('nm') }),
  ]);
  expect(out[0].second.image).toBe('/wp-content/card/cardimage/nmb.jpg');
  expect(out[0].second.name).toBe('裏');
});

test('違う名前のカードには影響しない。元の配列は変えない', () => {
  const cards = [card('x', { name: 'A' }), card('y', { name: 'B', number: '㊙1/㊙2' })];
  const out = useNormalImages(cards);
  expect(out[1].image).toBe('/wp-content/card/cardimage/y.jpg');
  expect(cards[0]).not.toBe(out[0]);
});

test('画像のない版は選ばない', () => {
  const out = useNormalImages([card('noimg', { number: '1/5', releaseOrder: 1, image: null, thumb: null }), card('ok', { number: '㊙1/㊙2', releaseOrder: 5 })]);
  expect(out[0].image).toBe('/wp-content/card/cardimage/ok.jpg');
});
