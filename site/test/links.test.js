import { describe, test, expect } from 'vitest';
import { buildLinks, imageUrl, thumbUrl } from '../js/links.js';

const card = (name, extra = {}) => ({ id: 'dm26ex5-SEC001CHO', name, image: '/wp-content/card/cardimage/dm26ex5-SEC001CHO.jpg', thumb: '/wp-content/card/cardthumb/dm26ex5-SEC001CHO.jpg', ...extra });

describe('buildLinks', () => {
  test('公式・メルカリ・カーナベル・YouTube の URL', () => {
    const l = buildLinks(card('ボルシャック・ドラゴン'));
    expect(l.official).toBe('https://dm.takaratomy.co.jp/card/detail/?id=dm26ex5-SEC001CHO');
    expect(l.mercari).toBe(
      `https://jp.mercari.com/search?keyword=${encodeURIComponent('ボルシャック・ドラゴン')}&status=on_sale&sort=price&order=asc`,
    );
    expect(l.kanabellSell).toBe(`https://www.ka-nabell.com/ec/sell/duel-masters/search?keyword=${encodeURIComponent('ボルシャック・ドラゴン')}`);
    expect(l.kanabellBuy).toBe(`https://www.ka-nabell.com/ec/buy/duel-masters/search?keyword=${encodeURIComponent('ボルシャック・ドラゴン')}`);
    expect(l.youtube).toBe(`https://www.youtube.com/results?search_query=${encodeURIComponent('デュエマ ボルシャック・ドラゴン')}`);
  });

  test('記号・空白・全角文字を含む名前でも、元の名前が URL から戻る', () => {
    const name = '《ボルシャック・ドラゴン》／テスト ＆ A+B #1 「誣」の頂 P’S';
    const l = buildLinks(card(name));
    expect(new URL(l.mercari).searchParams.get('keyword')).toBe(name);
    expect(new URL(l.kanabellSell).searchParams.get('keyword')).toBe(name);
    expect(new URL(l.kanabellBuy).searchParams.get('keyword')).toBe(name);
    expect(new URL(l.youtube).searchParams.get('search_query')).toBe(`デュエマ ${name}`);
    expect(new URL(l.official).searchParams.get('id')).toBe('dm26ex5-SEC001CHO');
  });

  test('ツインパクトは表の面の名前で検索する', () => {
    const l = buildLinks(card('叡智の聖騎士 スクアーロ', { isTwinpact: true, second: { name: 'エナジー・ライト' } }));
    expect(new URL(l.mercari).searchParams.get('keyword')).toBe('叡智の聖騎士 スクアーロ');
  });
});

describe('画像の URL', () => {
  test('詳細用と一覧用は公式サイトの画像をそのまま指す', () => {
    const c = card('x');
    expect(imageUrl(c)).toBe('https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex5-SEC001CHO.jpg');
    expect(thumbUrl(c)).toBe('https://dm.takaratomy.co.jp/wp-content/card/cardthumb/dm26ex5-SEC001CHO.jpg');
  });
  test('サムネイルがなければ詳細用の画像を使い、どちらもなければ null', () => {
    expect(thumbUrl(card('x', { thumb: null }))).toBe('https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex5-SEC001CHO.jpg');
    expect(thumbUrl(card('x', { thumb: null, image: null }))).toBeNull();
  });
});
