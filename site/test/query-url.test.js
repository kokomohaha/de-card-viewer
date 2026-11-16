import { test, expect } from 'vitest';
import { queryToHash, hashToQuery } from '../js/query-url.js';
import { defaultQuery } from '../js/filter.js';

test('初期値は空文字', () => {
  expect(queryToHash(defaultQuery())).toBe('');
  expect(hashToQuery('')).toEqual(defaultQuery());
});

test('日本語の文字検索・複数の文明・範囲・各種条件を往復しても同じ', () => {
  const q = {
    ...defaultQuery(),
    text: 'ボルシャック ドラゴン',
    civs: ['火', '自然'],
    civMode: 'all',
    colorCount: 'multi',
    costMin: 3,
    costMax: 7,
    powerMin: 5000,
    types: ['クリーチャー'],
    races: ['アーマード・ドラゴン'],
    rarities: ['SR'],
    products: ["DM26-EX5 デュエマプレイス・コラボパック 「電脳対戦 -WAR OF PLAY'S-」"],
    formats: ['current'],
    keywords: ['ブロッカー'],
    twinpactMode: 'exclude',
    illustrator: 'Kou1',
    groupSameName: false,
    sort: 'cost',
    order: 'asc',
    density: 3,
  };
  const h = queryToHash(q);
  expect(h.startsWith('#')).toBe(true);
  expect(hashToQuery(h)).toEqual(q);
});

test('値に & や = や , を含んでも壊れない', () => {
  const q = { ...defaultQuery(), text: 'A&B=C', races: ['ア,イ', 'ウ'] };
  expect(hashToQuery(queryToHash(q))).toEqual(q);
});

test('不正な値は初期値に戻り、例外にならない', () => {
  const q = hashToQuery('#cost=abc-zz&civ=炎&civMode=???&sort=hp&order=up&density=9&group=maybe&%E0%A4%A');
  expect(q).toEqual(defaultQuery());
});
