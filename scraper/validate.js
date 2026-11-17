/**
 * 公式ページの作りが変わって項目が取れなくなったことに気づくための点検。
 * @returns {string[]} 問題の説明（空なら OK）
 */
export function validateCard(card) {
  const errs = [];
  const id = card?.id || '(idなし)';
  const need = (cond, field) => { if (!cond) errs.push(`${id}: ${field} が取れていません`); };
  need(card?.id, 'id');
  need(card?.name, 'name');
  need(card?.type, 'type');
  need(Array.isArray(card?.civilizations) && card.civilizations.length > 0, 'civilizations');
  need(card?.image, 'image');
  // 2つ目の面は、種類や文明が公式に書かれていないカードがある（ツインパクトの呪文側など）ので名前だけ確かめる
  if (card?.second) need(card.second.name, 'second.name');
  return errs;
}
