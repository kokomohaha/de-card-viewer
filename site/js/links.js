// 外部サイトへのリンク。アフィリエイト用のパラメータは付けない。
// カーナベル（2026-11-17 確認）:
//   販売: https://www.ka-nabell.com/ec/sell/duel-masters/search?keyword={名前}
//   買取: https://www.ka-nabell.com/ec/buy/duel-masters/search?keyword={名前}

const OFFICIAL = 'https://dm.takaratomy.co.jp';
const enc = encodeURIComponent;

/** @param {{id: string, name: string}} card */
export function buildLinks(card) {
  const name = card.name;
  return {
    official: `${OFFICIAL}/card/detail/?id=${enc(card.id)}`,
    mercari: `https://jp.mercari.com/search?keyword=${enc(name)}&status=on_sale&sort=price&order=asc`,
    kanabellSell: `https://www.ka-nabell.com/ec/sell/duel-masters/search?keyword=${enc(name)}`,
    kanabellBuy: `https://www.ka-nabell.com/ec/buy/duel-masters/search?keyword=${enc(name)}`,
    youtube: `https://www.youtube.com/results?search_query=${enc(`デュエマ ${name}`)}`,
  };
}

/** 詳細用の大きな画像（公式サイトの画像をそのまま表示する）。 */
export function imageUrl(card) {
  return card.image ? OFFICIAL + card.image : null;
}

/** 両面カードの裏面の画像。なければ null。 */
export function backImageUrl(card) {
  return card.second?.image ? OFFICIAL + card.second.image : null;
}

/** 一覧用の小さな画像。なければ詳細用の画像。 */
export function thumbUrl(card) {
  return card.thumb ? OFFICIAL + card.thumb : imageUrl(card);
}
