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
  if (card?.second) {
    need(card.second.name, 'second.name');
    need(card.second.type, 'second.type');
    need(Array.isArray(card.second.civilizations) && card.second.civilizations.length > 0, 'second.civilizations');
  }
  return errs;
}
