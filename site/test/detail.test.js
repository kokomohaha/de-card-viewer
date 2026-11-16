// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest';
import { createDetail } from '../js/detail.js';

const card = (o = {}) => ({
  id: 'dm26ex5-SEC001CHO', name: 'ボルシャック・ドラゴン', type: 'クリーチャー', civilizations: ['火'], cost: 6, costRaw: '6',
  power: 6000, powerRaw: '6000+', mana: 1, races: ['アーマード・ドラゴン'], abilities: 'W・ブレイカー', flavor: '',
  rarity: 'SR', illustrator: 'Kou1', products: ['DM01'], image: '/wp-content/card/cardimage/x.jpg',
  thumb: '/wp-content/card/cardthumb/x.jpg', second: null, isTwinpact: false, ...o,
});

let aside;
let closed;
let detail;
beforeEach(() => {
  document.body.innerHTML = '<aside id="detail" hidden></aside>';
  aside = document.getElementById('detail');
  closed = 0;
  detail = createDetail(aside, { onClose: () => closed++ });
});
const press = (key) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));

test('カードを選ぶと、画像の拡大図を情報と一緒に表示する', () => {
  detail.show(card());
  expect(aside.hidden).toBe(false);
  expect(aside.classList.contains('has-image')).toBe(true);
  const img = aside.querySelector('.detail__media img');
  expect(img).not.toBeNull();
  expect(img.getAttribute('alt')).toBe('ボルシャック・ドラゴン');
  // 一覧で読み込み済みの画像をすぐ出す
  expect(img.getAttribute('src')).toBe('https://dm.takaratomy.co.jp/wp-content/card/cardthumb/x.jpg');
  expect(aside.querySelector('.detail__info h2').textContent).toBe('ボルシャック・ドラゴン');
});

test('画像を押すと全画面の拡大表示が開き、押すか Esc で閉じる（詳細は閉じない）', () => {
  detail.show(card());
  aside.querySelector('.detail__zoom').click();
  const box = document.querySelector('.lightbox');
  expect(box).not.toBeNull();
  expect(box.querySelector('img').getAttribute('src')).toBe('https://dm.takaratomy.co.jp/wp-content/card/cardimage/x.jpg');
  press('Escape');
  expect(document.querySelector('.lightbox')).toBeNull();
  expect(aside.hidden).toBe(false);
  aside.querySelector('.detail__zoom').click();
  document.querySelector('.lightbox').click();
  expect(document.querySelector('.lightbox')).toBeNull();
  press('Escape');
  expect(aside.hidden).toBe(true);
  expect(closed).toBe(1);
});

test('画像がないカードは拡大図の欄を出さない', () => {
  detail.show(card({ image: null, thumb: null }));
  expect(aside.querySelector('.detail__media')).toBeNull();
  expect(aside.classList.contains('has-image')).toBe(false);
  expect(aside.querySelector('h2').textContent).toBe('ボルシャック・ドラゴン');
});

test('画像が読み込めなければ拡大図の欄を消す', () => {
  detail.show(card());
  aside.querySelector('.detail__media img').dispatchEvent(new Event('error'));
  expect(aside.querySelector('.detail__media')).toBeNull();
  expect(aside.classList.contains('has-image')).toBe(false);
});
