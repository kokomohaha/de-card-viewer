import fs from 'node:fs';
import path from 'node:path';

// Cloudflare Pages は1ファイル 25MiB まで。全カード（約24,000枚・約28MB）を1つにすると
// 公開に失敗するので、CHUNK_SIZE 枚ずつ cards-0.json, cards-1.json … に分けて書く（1つ約5MB）。
export const CHUNK_SIZE = 4000;
const CHUNK_RE = /^cards-(\d+)\.json$/;

function chunkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map((f) => [f, CHUNK_RE.exec(f)])
    .filter(([, m]) => m)
    .sort((a, b) => Number(a[1][1]) - Number(b[1][1]))
    .map(([f]) => f);
}

function writeAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

/** @returns {string[]} 書いたファイル名（meta.json の cardFiles に入れる） */
export function writeCards(cardsPath, cards) {
  const dir = path.dirname(cardsPath);
  fs.mkdirSync(dir, { recursive: true });
  const names = [];
  for (let i = 0; i * CHUNK_SIZE < Math.max(cards.length, 1); i++) {
    const name = `cards-${i}.json`;
    writeAtomic(path.join(dir, name), cards.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    names.push(name);
  }
  for (const f of chunkFiles(dir)) if (!names.includes(f)) fs.rmSync(path.join(dir, f));
  fs.rmSync(cardsPath, { force: true });
  return names;
}

export function readCards(cardsPath, fallback = []) {
  const dir = path.dirname(cardsPath);
  const files = chunkFiles(dir);
  if (files.length) return files.flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  if (fs.existsSync(cardsPath)) return JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  return fallback;
}
