import { test, expect } from 'vitest';
import { loadCards } from '../js/load-cards.js';

const fakeLoad = (files) => async (p) => {
  if (!(p in files)) throw new Error(`${p}: 404`);
  return files[p];
};

test('meta.cardFiles の分割ファイルを全部読み、順番どおりにつなげる', async () => {
  const load = fakeLoad({ 'data/cards-0.json': [{ id: 'a' }, { id: 'b' }], 'data/cards-1.json': [{ id: 'c' }] });
  const cards = await loadCards({ cardFiles: ['cards-0.json', 'cards-1.json'] }, load);
  expect(cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
});

test('cardFiles がない古い meta なら data/cards.json を読む', async () => {
  const cards = await loadCards({}, fakeLoad({ 'data/cards.json': [{ id: 'x' }] }));
  expect(cards).toEqual([{ id: 'x' }]);
});

test('1つでも読めなければ失敗する（一部のカードだけ出るのを防ぐ）', async () => {
  const load = fakeLoad({ 'data/cards-0.json': [{ id: 'a' }] });
  await expect(loadCards({ cardFiles: ['cards-0.json', 'cards-1.json'] }, load)).rejects.toThrow();
});
