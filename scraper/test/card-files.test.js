import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeCards, readCards, CHUNK_SIZE } from '../card-files.js';

let dir;
let cardsPath;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dmfiles-'));
  cardsPath = path.join(dir, 'data/cards.json');
});
const make = (n) => Array.from({ length: n }, (_, i) => ({ id: `c-${i}` }));

test('Cloudflare の1ファイル25MiB制限に収まるよう、CHUNK_SIZE 枚ずつ cards-N.json に分けて書く', () => {
  const names = writeCards(cardsPath, make(CHUNK_SIZE * 2 + 1));
  expect(names).toEqual(['cards-0.json', 'cards-1.json', 'cards-2.json']);
  const second = JSON.parse(fs.readFileSync(path.join(dir, 'data/cards-1.json'), 'utf8'));
  expect(second).toHaveLength(CHUNK_SIZE);
  expect(second[0].id).toBe(`c-${CHUNK_SIZE}`);
});

test('読むと元の順番で1つの配列に戻る', () => {
  const cards = make(CHUNK_SIZE + 5);
  writeCards(cardsPath, cards);
  expect(readCards(cardsPath)).toEqual(cards);
});

test('古い cards.json と、使わなくなった後ろのファイルは消す', () => {
  fs.mkdirSync(path.dirname(cardsPath), { recursive: true });
  fs.writeFileSync(cardsPath, '[]');
  writeCards(cardsPath, make(CHUNK_SIZE * 3));
  writeCards(cardsPath, make(10));
  expect(fs.readdirSync(path.join(dir, 'data')).sort()).toEqual(['cards-0.json']);
});

test('分割前の cards.json しかなければそれを読む。何もなければ fallback', () => {
  expect(readCards(cardsPath, null)).toBe(null);
  fs.mkdirSync(path.dirname(cardsPath), { recursive: true });
  fs.writeFileSync(cardsPath, '[{"id":"old"}]');
  expect(readCards(cardsPath)).toEqual([{ id: 'old' }]);
});
