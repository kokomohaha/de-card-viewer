// 画像はすべて「通常版」のものを使う。
// 通常版 = 収録番号が「51/55」のような数字だけの版。同じ名前の中で一番古いもの。
// 通常版がない名前（プロモだけ等）は、一番古い版の画像を使う。

/** 収録番号が「数字/数字」なら通常版。 */
export function isNormalNumber(number) {
  return typeof number === 'string' && /^\d+\/\d+$/.test(number.trim());
}

function better(a, b) {
  const na = isNormalNumber(a.number);
  const nb = isNormalNumber(b.number);
  if (na !== nb) return na ? a : b;
  return (a.releaseOrder ?? 0) <= (b.releaseOrder ?? 0) ? a : b;
}

/**
 * 同じ名前のカードの画像（表・裏・一覧用）を、通常版のものに置き換えた新しい配列を返す。
 * カード名・収録番号・収録商品など、画像以外の情報はそのまま。
 */
export function useNormalImages(cards) {
  const best = new Map();
  for (const c of cards) {
    if (!c.image) continue;
    const cur = best.get(c.name);
    best.set(c.name, cur ? better(cur, c) : c);
  }
  return cards.map((c) => {
    const n = best.get(c.name);
    if (!n || n === c) return { ...c };
    return {
      ...c,
      image: n.image,
      thumb: n.thumb ?? c.thumb,
      second: c.second ? { ...c.second, image: n.second?.image ?? c.second.image ?? null } : c.second,
    };
  });
}
