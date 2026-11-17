import { test, expect } from 'vitest';
import { validateCard } from '../validate.js';

const good = () => ({
  id: 'dm01-001', name: 'テスト', type: 'クリーチャー', rarity: 'C', civilizations: ['火'],
  image: '/wp-content/card/cardimage/dm01-001.jpg', second: null, isTwinpact: false,
});

test('正しいカードは問題なし', () => {
  expect(validateCard(good())).toEqual([]);
});

test('必須項目が欠けると、その項目の説明が返る', () => {
  const c = { ...good(), name: '', civilizations: [], image: null };
  const errs = validateCard(c);
  expect(errs.some((e) => e.includes('name'))).toBe(true);
  expect(errs.some((e) => e.includes('civilizations'))).toBe(true);
  expect(errs.some((e) => e.includes('image'))).toBe(true);
  expect(errs.every((e) => e.startsWith('dm01-001'))).toBe(true);
});

test('2つ目の面は名前が必要', () => {
  const c = { ...good(), second: { name: '', type: '呪文', civilizations: ['水'] } };
  expect(validateCard(c).some((e) => e.includes('second.name'))).toBe(true);
});

test('2つ目の面の種類・文明は空でもよい（公式に書かれていないカードがある）', () => {
  const c = { ...good(), second: { name: 'ボルメテウス・レジェンド・フレア', type: '', civilizations: [] } };
  expect(validateCard(c)).toEqual([]);
});

test('レアリティなしのカードは許す（公式に「レアリティなし」がある）', () => {
  expect(validateCard({ ...good(), rarity: '' })).toEqual([]);
});
