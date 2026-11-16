import { describe, test, expect } from 'vitest';
import { defaultQuery, filterCards, matchesCard, sortCards, groupSameName, normalize } from '../js/filter.js';

const face = (o) => ({
  name: 'x', reading: null, type: 'クリーチャー', civilizations: ['火'], cost: 5, costRaw: '5', power: 5000, powerRaw: '5000',
  mana: 1, races: ['アーマード・ドラゴン'], abilities: '', flavor: '', ...o,
});
const card = (o) => ({
  ...face(o), id: o.id ?? 'id', rarity: 'C', illustrator: 'Taro', products: ['DM01 第1弾'], formats: ['original'],
  releaseOrder: 1, second: null, isTwinpact: false, image: '/a.jpg', thumb: '/a.jpg', ...o,
});
const q = (o) => ({ ...defaultQuery(), groupSameName: false, ...o });
const ids = (cards) => cards.map((c) => c.id);
const sorted = (cards) => ids(cards).sort();

const CARDS = [
  card({ id: 'fire', name: 'ボルシャック・ドラゴン', civilizations: ['火'], cost: 6, power: 6000, releaseOrder: 10, abilities: 'パワーアタッカー＋1000', illustrator: 'Kou1' }),
  card({ id: 'water', name: 'アクア・ハルカス', civilizations: ['水'], cost: 3, power: 2000, races: ['リキッド・ピープル'], releaseOrder: 20, abilities: 'カードを1枚引く', formats: ['original', 'current'] }),
  card({ id: 'multi', name: 'ボルバルザーク・エクス', civilizations: ['火', '自然'], cost: 7, power: 7000, releaseOrder: 30, rarity: 'SR' }),
  card({ id: 'spell', name: 'デーモン・ハンド', type: '呪文', civilizations: ['闇'], cost: 6, power: null, powerRaw: null, races: [], releaseOrder: 5 }),
  card({ id: 'inf', name: '∞龍 ゲンムエンペラー', civilizations: ['水', '闇'], cost: null, costRaw: '∞', power: null, powerRaw: '∞', releaseOrder: 40, rarity: 'KGM' }),
  card({
    id: 'tw', name: '叡智の聖騎士 スクアーロ', type: 'NEOクリーチャー', civilizations: ['水'], cost: 4, power: 5000, releaseOrder: 50, isTwinpact: true,
    second: face({ name: 'エナジー・ライト', type: '呪文', civilizations: ['光'], cost: 3, power: null, races: [], abilities: 'カードを２枚引く' }),
  }),
];

describe('文字検索', () => {
  test('空白で区切った語をすべて含むもの', () => {
    expect(sorted(filterCards(CARDS, q({ text: 'ボル ドラゴン' })))).toEqual(['fire', 'multi'].sort());
  });
  test('カタカナとひらがな、全角と半角を区別しない', () => {
    expect(normalize('ボルシャック１０００ＡＢ')).toBe(normalize('ぼるしゃっく1000ab'));
    expect(sorted(filterCards(CARDS, q({ text: 'あくあ' })))).toEqual(['water'].sort());
    expect(sorted(filterCards(CARDS, q({ text: 'パワーアタッカー+1000' })))).toEqual(['fire'].sort());
  });
  test('能力・種族・イラストレーターも対象', () => {
    expect(sorted(filterCards(CARDS, q({ text: 'リキッド' })))).toEqual(['water'].sort());
    expect(sorted(filterCards(CARDS, q({ text: 'kou1' })))).toEqual(['fire'].sort());
  });
  test('ツインパクトの2つ目の面の名前や能力でも当たる', () => {
    expect(sorted(filterCards(CARDS, q({ text: 'エナジー' })))).toEqual(['tw'].sort());
  });
});

describe('文明', () => {
  test('any: 選んだ文明のどれかを含む', () => {
    expect(sorted(filterCards(CARDS, q({ civs: ['自然'], civMode: 'any' })))).toEqual(['multi'].sort());
  });
  test('only: 選んだ文明以外を含まない', () => {
    expect(sorted(filterCards(CARDS, q({ civs: ['火'], civMode: 'only' })))).toEqual(['fire'].sort());
  });
  test('all: 選んだ文明をすべて含む', () => {
    expect(sorted(filterCards(CARDS, q({ civs: ['水', '闇'], civMode: 'all' })))).toEqual(['inf'].sort());
  });
  test('単色・多色', () => {
    expect(sorted(filterCards(CARDS, q({ colorCount: 'multi' })))).toEqual(['multi', 'inf'].sort());
    expect(sorted(filterCards(CARDS, q({ colorCount: 'mono' })))).toEqual(['fire', 'water', 'spell', 'tw'].sort());
  });
  test('ツインパクトはどちらかの面の文明で当たる', () => {
    expect(sorted(filterCards(CARDS, q({ civs: ['光'] })))).toEqual(['tw'].sort());
  });
});

describe('コスト・パワーの範囲', () => {
  test('範囲を指定すると値がないカードは外れる', () => {
    expect(sorted(filterCards(CARDS, q({ powerMin: 5000 })))).toEqual(['fire', 'multi', 'tw'].sort());
    expect(sorted(filterCards(CARDS, q({ costMin: 6, costMax: 7 })))).toEqual(['fire', 'multi', 'spell'].sort());
  });
  test('範囲を指定しなければ値がないカードも残る', () => {
    expect(filterCards(CARDS, q({}))).toHaveLength(CARDS.length);
  });
  test('ツインパクトは2つ目の面のコストでも当たる', () => {
    expect(sorted(filterCards(CARDS, q({ costMin: 3, costMax: 3 })))).toEqual(['water', 'tw'].sort());
  });
});

describe('その他の条件', () => {
  test('種類・種族・レアリティ・フォーマット・特殊能力', () => {
    expect(sorted(filterCards(CARDS, q({ types: ['呪文'] })))).toEqual(['spell', 'tw'].sort());
    expect(sorted(filterCards(CARDS, q({ races: ['リキッド・ピープル'] })))).toEqual(['water'].sort());
    expect(sorted(filterCards(CARDS, q({ rarities: ['SR', 'KGM'] })))).toEqual(['multi', 'inf'].sort());
    expect(sorted(filterCards(CARDS, q({ formats: ['current'] })))).toEqual(['water'].sort());
    expect(sorted(filterCards(CARDS, q({ keywords: ['パワーアタッカー'] })))).toEqual(['fire'].sort());
  });
  test('収録商品', () => {
    const cs = [card({ id: 'a', products: ['DM01 第1弾', 'DM02'] }), card({ id: 'b', products: ['DM03'] })];
    expect(sorted(filterCards(cs, q({ products: ['DM02'] })))).toEqual(['a'].sort());
  });
  test('ツインパクトのみ・除く', () => {
    expect(sorted(filterCards(CARDS, q({ twinpactMode: 'only' })))).toEqual(['tw'].sort());
    expect(filterCards(CARDS, q({ twinpactMode: 'exclude' }))).toHaveLength(CARDS.length - 1);
  });
  test('matchesCard は単体で使える', () => {
    expect(matchesCard(CARDS[0], q({ civs: ['火'] }))).toBe(true);
    expect(matchesCard(CARDS[1], q({ civs: ['火'] }))).toBe(false);
  });
});

describe('並べ替えと同名まとめ', () => {
  test('初期値は発売日の新しい順・同名まとめオン', () => {
    const d = defaultQuery();
    expect(d).toMatchObject({ sort: 'release', order: 'desc', groupSameName: true, density: 2, civMode: 'any', colorCount: 'any', twinpactMode: 'any' });
    expect(ids(filterCards(CARDS, d))).toEqual(['tw', 'inf', 'multi', 'water', 'fire', 'spell']);
  });
  test('コスト順で値がないものは最後、同じ値は新しい順', () => {
    expect(ids(sortCards(CARDS, 'cost', 'asc'))).toEqual(['water', 'tw', 'fire', 'spell', 'multi', 'inf']);
    expect(ids(sortCards(CARDS, 'power', 'desc'))).toEqual(['multi', 'fire', 'tw', 'water', 'inf', 'spell']);
  });
  test('名前順', () => {
    expect(ids(sortCards(CARDS.filter((c) => c.id !== 'inf'), 'name', 'asc'))[0]).toBe('water');
  });
  test('同名カードは一番新しい1枚だけ残す', () => {
    const cs = [card({ id: 'old', name: '同じ', releaseOrder: 1 }), card({ id: 'new', name: '同じ', releaseOrder: 9 }), card({ id: 'other', name: '別' })];
    expect(ids(groupSameName(cs)).sort()).toEqual(['new', 'other']);
  });
});

test('24,000件で filterCards が 100ms 以内', () => {
  const many = [];
  for (let i = 0; i < 4000; i++) for (const c of CARDS) many.push({ ...c, id: `${c.id}-${i}`, name: `${c.name}${i}`, releaseOrder: i });
  filterCards(many, q({ text: 'ドラゴン' })); // 1回目で準備
  const t = performance.now();
  filterCards(many, q({ text: 'ボル', civs: ['火'], costMin: 3 }));
  expect(performance.now() - t).toBeLessThan(100);
});
