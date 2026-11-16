import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import { parseListPage, listPageRequest, parseFilterOptions, parseRightsNotice } from '../parse-list.js';

const fx = (n) => fs.readFileSync(new URL(`./fixtures/${n}.html`, import.meta.url), 'utf8');

describe('parseListPage', () => {
  test('1ページ目から50件のIDとサムネイルが取れ、次のページがある', () => {
    const r = parseListPage(fx('list-p1'));
    expect(r.items).toHaveLength(50);
    for (const it of r.items) {
      expect(it.id).toMatch(/^[A-Za-z0-9]+-[A-Za-z0-9]+$/);
      expect(it.thumb).toMatch(/^\/wp-content\/card\/cardthumb\/.+\.jpg$/);
    }
    expect(r.items[0].id).toBe('dm26ex5-SEC001CHO');
    expect(r.page).toBe(1);
    expect(r.lastPage).toBe(482);
    expect(r.hasNext).toBe(true);
  });

  test('ツインパクトのサムネイルは a 付きのファイル名をそのまま返す', () => {
    const r = parseListPage(fx('list-p1'));
    expect(r.items.find((i) => i.id === 'dm26ex5-G003').thumb).toBe('/wp-content/card/cardthumb/dm26ex5-G003a.jpg');
  });

  test('最後のページでは hasNext が false', () => {
    const r = parseListPage(fx('list-last'));
    expect(r.page).toBe(482);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.hasNext).toBe(false);
  });

  test('2ページ目は2ページ目として読める', () => {
    const r = parseListPage(fx('list-p2'));
    expect(r.page).toBe(2);
    expect(r.items).toHaveLength(50);
  });
});

describe('listPageRequest', () => {
  test('同名カードを表示する条件付きで POST する', () => {
    expect(listPageRequest(3)).toEqual({
      url: 'https://dm.takaratomy.co.jp/card/',
      body: 'pagenum=3&samename=show',
    });
  });
  test('フォーマットで絞り込める', () => {
    expect(listPageRequest(1, { format: 'current' }).body).toBe('pagenum=1&samename=show&format=current');
  });
});

describe('parseFilterOptions', () => {
  test('種族・商品・特殊能力・レアリティ・種類の選択肢が取れる', () => {
    const o = parseFilterOptions(fx('list-p1'));
    expect(o.races.length).toBeGreaterThan(100);
    expect(o.keywords.length).toBeGreaterThan(100);
    expect(o.types).toContain('クリーチャー');
    expect(o.rarities).toContain('SR');
    expect(o.products[0]).toEqual({ name: "DM26-EX5 デュエマプレイス・コラボパック 「電脳対戦 -WAR OF PLAY'S-」", order: o.products.length - 1 });
    expect(o.races).not.toContain('指定なし');
  });
});

describe('parseRightsNotice', () => {
  test('フッターの権利表記を取り出す', () => {
    expect(parseRightsNotice(fx('list-p1'))).toBe(
      '©ANYCOLOR, Inc. TM and ©2026 Wizards of the Coast/Shogakukan/WHC/ShoPro ©TOMY',
    );
  });
});
