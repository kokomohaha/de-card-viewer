import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import { parseDetailPage, toNumberOrNull } from '../parse-detail.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.html`, import.meta.url), 'utf8');

describe('parseDetailPage', () => {
  test('通常のクリーチャー', () => {
    const c = parseDetailPage(fx('detail-creature'), 'dm26ex5-SEC001CHO');
    expect(c).toMatchObject({
      id: 'dm26ex5-SEC001CHO',
      name: '「誣」の頂 ウェディング・イノセンス',
      type: 'クリーチャー',
      civilizations: ['ゼロ'],
      rarity: 'SR',
      cost: 13,
      power: 13000,
      powerRaw: '13000',
      mana: 1,
      races: ['アンノウン', 'ゼニス'],
      illustrator: 'Yoshimo',
      image: '/wp-content/card/cardimage/dm26ex5-SEC001CHO.jpg',
      second: null,
      isTwinpact: false,
      formats: [],
      releaseOrder: 0,
    });
    expect(c.abilities.length).toBeGreaterThan(0);
    expect(c.products[0]).toMatch(/^DM26-EX5/);
  });

  test('呪文はパワーが null', () => {
    const c = parseDetailPage(fx('detail-spell'), 'dmr14-051');
    expect(c.type).toBe('呪文');
    expect(c.power).toBeNull();
    expect(c.powerRaw).toBeNull();
    expect(c.races).toEqual([]);
  });

  test('多色は文明が複数', () => {
    const c = parseDetailPage(fx('detail-multi'), 'dm23rp2x-TR07');
    expect(c.civilizations).toEqual(['光', '水', '闇', '火', '自然']);
    expect(c.products.length).toBeGreaterThanOrEqual(2);
  });

  test('パワーとコストが ∞ のときは数値 null・元の文字列を残す', () => {
    const c = parseDetailPage(fx('detail-plus'), 'dmart11-002');
    expect(c.power).toBeNull();
    expect(c.powerRaw).toBe('∞');
    expect(c.cost).toBeNull();
    expect(c.costRaw).toBe('∞');
  });

  test('ツインパクトは2つ目の面があり、isTwinpact', () => {
    const c = parseDetailPage(fx('detail-twinpact'), 'dm26ex5-G003');
    expect(c.isTwinpact).toBe(true);
    expect(c.name).toBe('叡智の聖騎士 スクアーロ');
    expect(c.second.name).toBe('エナジー・ライト');
    expect(c.second.type).toBe('呪文');
    expect(c.second.cost).toBe(3);
    expect(c.image).toBe('/wp-content/card/cardimage/dm26ex5-G003a.jpg');
  });

  test('両面のドラグハートは2つ目の面があるがツインパクトではない', () => {
    const c = parseDetailPage(fx('detail-dragheart'), 'dmr14-v01');
    expect(c.isTwinpact).toBe(false);
    expect(c.name).toBe('龍波動空母 エビデゴラス');
    expect(c.second.name).toBe('最終龍理 Q.E.D.+');
    expect(c.second.power).toBe(11000);
    expect(c.mana).toBeNull();
  });

  test('カードの部分がないページは例外', () => {
    expect(() => parseDetailPage('<html><body>not found</body></html>', 'x-1')).toThrow();
  });
});

describe('toNumberOrNull', () => {
  test.each([
    ['13000', 13000],
    ['12000+', 12000],
    ['１２０００', 12000],
    ['∞', null],
    ['-', null],
    ['', null],
  ])('%s → %s', (raw, n) => expect(toNumberOrNull(raw)).toBe(n));
});
