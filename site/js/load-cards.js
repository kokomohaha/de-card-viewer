// カードデータは Cloudflare の1ファイル上限のため cards-0.json, cards-1.json … に分かれている。
// meta.json の cardFiles に並んだファイルを同時に読み、順番どおりにつなげる。
export async function loadCards(meta, loadJson) {
  const files = meta.cardFiles?.length ? meta.cardFiles : ['cards.json'];
  const parts = await Promise.all(files.map((f) => loadJson(`data/${f}`)));
  return parts.flat();
}
