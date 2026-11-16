// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { renderTile } from '../js/card-tile.js';

const card = (o = {}) => ({
  id: 'dm26ex5-SEC001CHO', name: 'ボルシャック・ドラゴン', type: 'クリーチャー', civilizations: ['火'], cost: 6, costRaw: '6',
  power: 6000, powerRaw: '6000+', races: ['アーマード・ドラゴン'], image: '/wp-content/card/cardimage/x.jpg',
  thumb: '/wp-content/card/cardthumb/x.jpg', second: null, isTwinpact: false, ...o,
});

test('一覧用の小さな公式画像を遅延読み込みで表示する', () => {
  const el = renderTile(card());
  expect(el.tagName).toBe('BUTTON');
  expect(el.dataset.id).toBe('dm26ex5-SEC001CHO');
  const img = el.querySelector('img');
  expect(img.getAttribute('src')).toBe('https://dm.takaratomy.co.jp/wp-content/card/cardthumb/x.jpg');
  expect(img.getAttribute('loading')).toBe('lazy');
  expect(img.getAttribute('alt')).toBe('ボルシャック・ドラゴン');
  expect(el.classList.contains('tile--text')).toBe(false);
  expect(el.querySelector('.tile__cap').textContent).toContain('ボルシャック・ドラゴン');
});

test('画像が読み込めないと文字のカードになり、名前・コスト・パワー・種族が見える', () => {
  const el = renderTile(card());
  el.querySelector('img').dispatchEvent(new Event('error'));
  expect(el.classList.contains('tile--text')).toBe(true);
  expect(el.querySelector('img')).toBeNull();
  const t = el.querySelector('.tile__text').textContent;
  expect(t).toContain('ボルシャック・ドラゴン');
  expect(t).toContain('6');
  expect(t).toContain('6000+');
  expect(t).toContain('アーマード・ドラゴン');
});

test('画像の URL がなければ最初から文字のカード', () => {
  const el = renderTile(card({ thumb: null, image: null }));
  expect(el.classList.contains('tile--text')).toBe(true);
  expect(el.querySelector('img')).toBeNull();
});

test('ツインパクトの文字のカードには両方の面の名前が出る', () => {
  const el = renderTile(card({ thumb: null, image: null, isTwinpact: true, name: '叡智の聖騎士 スクアーロ', second: { name: 'エナジー・ライト', civilizations: ['光'], cost: 3, costRaw: '3', races: [] } }));
  const t = el.querySelector('.tile__text').textContent;
  expect(t).toContain('叡智の聖騎士 スクアーロ');
  expect(t).toContain('エナジー・ライト');
});

test('文明の色の帯は、カードの文明の数だけ色を持つ', () => {
  const el = renderTile(card({ civilizations: ['火', '自然'] }));
  const band = el.querySelector('.tile__band').getAttribute('style');
  expect(band).toContain('var(--civ-fire)');
  expect(band).toContain('var(--civ-nature)');
});

test('名前に HTML の記号があっても文字として表示する', () => {
  const el = renderTile(card({ name: '<b>x</b>&', thumb: null, image: null }));
  expect(el.querySelector('b')).toBeNull();
  expect(el.querySelector('.tile__text').textContent).toContain('<b>x</b>&');
});
