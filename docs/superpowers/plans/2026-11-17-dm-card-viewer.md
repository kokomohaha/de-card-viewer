# デュエマ カード一覧ビューア 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公式のカード検索から集めたデータで、1画面にたくさんのカードを並べて絞り込める、非営利のデュエマカード一覧サイトを作る。

**Architecture:** Node.js の読み取りプログラムが公式サイトを1秒に1回以下の速さで読み、`site/data/cards.json` を作る。`site/` はビルド不要の静的サイト（素の JavaScript の ES モジュール）で、絞り込み・並べ替え・表示はすべてブラウザ内で行い、Cloudflare Pages で公開する。GitHub Actions が毎日1回起動し、必要なときだけ読み取りを行って、変更をコミットする。

**Tech Stack:** Node.js 20 以上、cheerio（HTML の解析）、Vitest（テスト）、素の HTML/CSS/JavaScript、GitHub Actions、Cloudflare Pages

**Spec:** `docs/superpowers/specs/2026-11-17-dm-card-viewer-design.md`

## Global Constraints

- 公式サイトへのアクセスは **1秒に1回以下**。User-Agent は `DMCardViewer/1.0 (+{サイトURL}; {専用Gmail})`。サイトの URL と Gmail アドレスは `scraper/config.js` の定数にする（ユーザーが決めたら埋める。それまでは `TODO_SITE_URL` と `TODO_CONTACT_EMAIL` を入れておき、`run.js` は TODO が残っていたら起動を拒否する）。
- 詳細ページ：`https://dm.takaratomy.co.jp/card/detail/?id={id}`。画像：`https://dm.takaratomy.co.jp/wp-content/card/cardimage/{id}.jpg`。
- **カード画像を保存・コピーしない。** `<img>` で公式の URL をそのまま表示する。
- 広告・アフィリエイト用パラメータ・解析タグ・ログインを入れない。
- 「公式」と誤解される名前や見た目にしない。フッターに「非公式のファンサイトです」、公式サイトのフッターにある権利表記（読み取りプログラムが `meta.json` の `rightsNotice` に保存した文字列）、専用 Gmail アドレスを表示する。
- 外部リンクはすべて `target="_blank" rel="noopener noreferrer"`。
- 一覧で画像を読み込むのは、画面に見えている範囲のカードだけ。
- 読み取りで項目が取れなかったときは、黙って空にせず止まる。不完全なデータでサイトを更新しない。
- 費用は GitHub と Cloudflare Pages の無料の枠に収める。サーバー側のプログラムや API キーは使わない。

## Review Focus

1. **記号・空白・全角文字を含むカード名**（《》、「」、・、＝、スペース、/）でも、メルカリ・カーナベル・YouTube の検索リンクが正しく開くこと → Task 5 の `links.test.js` にテストを追加。
2. **ツインパクトのカード**（1枚に2つの面）：どちらの面のコスト・文明・名前・種類でも絞り込みに当たること → Task 6 の `filter.test.js` にテストを追加。
3. **パワーやコストがない・数字でないカード**（呪文のパワーなし、`12000+`、`∞`、コスト `-`）：解析で落ちず、範囲の絞り込みでは除外され、範囲を指定しないときは表示されること → Task 2 と Task 6 にテストを追加。
4. **公式の画像が読み込めない**（404、外部表示の拒否）：そのカードは文字のカードで表示され、一覧が崩れないこと → Task 8 の `card-tile.test.js` にテストを追加。
5. **全件読み直しが途中で止まった**（6時間の制限、ネットワークの失敗）：公開中の `cards.json` は前回の完全なデータのまま変わらず、次回は続きから再開すること → Task 4 の `run.test.js` にテストを追加。

---

## ファイル構成

```
package.json                      依存関係と npm スクリプト
.gitignore
scraper/
  config.js                       定数（URL、User-Agent、待ち時間、時間の上限）
  fetcher.js                      1秒に1回以下で取得する fetch。再試行あり
  parse-list.js                   一覧ページ → カードIDの配列、次のページの有無、絞り込みの選択肢
  parse-detail.js                 詳細ページ → Card
  validate.js                     Card の必須項目チェック
  state.js                        進み具合の保存と読み込み（再開用）
  run.js                          コマンド：--mode=auto|incremental|full
  test/
    fixtures/                     公式から保存した HTML（テスト用）
    *.test.js
site/
  index.html
  style.css
  data/cards.json                 生成物（Card の配列）
  data/meta.json                  生成物（更新日、件数、権利表記、絞り込みの選択肢）
  js/
    filter.js                     filterCards / sortCards / groupSameName
    query-url.js                  Query ⇔ URL のハッシュ
    links.js                      外部リンクの URL を作る
    card-tile.js                  一覧の1枚の HTML（画像か文字のカード）
    grid.js                       見えている範囲だけを描く一覧
    detail.js                     詳細パネル
    controls.js                   絞り込みの入力欄
    app.js                        全体をつなぐ
  test/*.test.js
.github/workflows/update-cards.yml
docs/setup-guide.md               ユーザー向けの公開手順書（日本語）
```

### 共通のデータ型（全タスクで使う）

```js
/** @typedef {Object} Face
 * @property {string} name
 * @property {string|null} reading
 * @property {string} type              // 例 "クリーチャー"
 * @property {string[]} civilizations   // 例 ["火"]。"光","水","闇","火","自然","ゼロ"
 * @property {number|null} cost         // 数字でないときは null
 * @property {number|null} power        // "12000+" → 12000。なし・"∞" → null
 * @property {string|null} powerRaw     // 表示用の元の文字列（"12000+", "∞"）
 * @property {number|null} mana
 * @property {string[]} races
 * @property {string} abilities         // 能力の文章（改行は \n）
 * @property {string} flavor
 */
/** @typedef {Face & {
 *   id: string,                        // 例 "dm26ex5-SEC001CHO"
 *   rarity: string,
 *   illustrator: string,
 *   products: string[],
 *   formats: string[],                 // "現行" / "オリジナル" のうち当てはまるもの
 *   releaseOrder: number,              // 大きいほど新しい
 *   twinpact: Face|null                // 2つ目の面
 * }} Card */
/** @typedef {Object} Query
 * @property {string} text              // カード名・読み・能力・種族・フレーバー・イラストレーター
 * @property {string[]} civs
 * @property {'any'|'only'|'all'} civMode
 * @property {'any'|'mono'|'multi'} colorCount
 * @property {number|null} costMin  @property {number|null} costMax
 * @property {number|null} powerMin @property {number|null} powerMax
 * @property {string[]} types @property {string[]} races @property {string[]} rarities
 * @property {string[]} products @property {string[]} formats @property {string[]} keywords
 * @property {'any'|'only'|'exclude'} twinpactMode
 * @property {string} illustrator
 * @property {boolean} groupSameName   // 初期値 true
 * @property {'release'|'name'|'cost'|'power'} sort
 * @property {'asc'|'desc'} order
 * @property {1|2|3} density           // 一覧の大きさ。初期値 2
 */
```

`site/data/meta.json`：`{ updatedAt: string(ISO), count: number, rightsNotice: string, options: { races: string[], rarities: string[], products: {name:string, order:number}[], keywords: string[], types: string[] } }`

---

### Task 1: プロジェクトの準備と、ゆっくり取得する fetch

**Files:**
- Create: `package.json`, `.gitignore`, `scraper/config.js`, `scraper/fetcher.js`
- Test: `scraper/test/fetcher.test.js`

**Interfaces:**
- Produces: `createFetcher({ minIntervalMs = 1000, fetchImpl = fetch, sleep, now }) → { get(url: string): Promise<string> }`。`config.js` は `BASE_URL`, `USER_AGENT`, `MIN_INTERVAL_MS = 1000`, `MAX_RUN_MINUTES = 330`, `assertConfigured(): void` を export。

- [ ] **Step 1:** `git init`。`package.json`（`"type": "module"`, scripts: `"test": "vitest run"`, `"scrape": "node scraper/run.js"`）、依存 `cheerio`、開発依存 `vitest`, `jsdom`。`.gitignore` に `node_modules/`, `scraper/.cache/`。`npm install`。
- [ ] **Step 2: 失敗するテストを書く** `fetcher.test.js`
  - `test('2回目の取得は前回から1000ms以上あけて行う')`：偽の `now` と `sleep` を渡し、2回 `get` したとき `sleep` が `>= 1000 - 経過時間` で呼ばれることを確認する。
  - `test('User-Agent ヘッダーを付ける')`：`fetchImpl` が受け取った `headers['User-Agent']` が `USER_AGENT` と等しい。
  - `test('500 と通信エラーは3回まで再試行し、だめなら例外')`：3回失敗で reject、2回失敗→成功なら本文を返す。
  - `test('404 は再試行せず FetchError(status=404) を投げる')`。
  - `test('TODO が残っていると assertConfigured が例外')`。
- [ ] **Step 3:** `npx vitest run scraper/test/fetcher.test.js` → FAIL（モジュールがない）。
- [ ] **Step 4:** `config.js` と `fetcher.js` を実装する。再試行の間隔は 5秒・15秒・45秒（テストでは `sleep` を偽物にする）。
- [ ] **Step 5:** 同じコマンド → PASS。
- [ ] **Step 6:** コミット `feat: add polite fetcher and config`

### Task 2: 公式ページの解析（一覧と詳細）

**Files:**
- Create: `scraper/parse-list.js`, `scraper/parse-detail.js`, `scraper/test/fixtures/*.html`
- Test: `scraper/test/parse-list.test.js`, `scraper/test/parse-detail.test.js`

**Interfaces:**
- Consumes: Task 1 の `createFetcher`（テスト用の HTML を保存するときだけ）
- Produces:
  - `parseListPage(html: string) → { ids: string[], hasNext: boolean }`
  - `listPageUrl(page: number, filters?: { format?: '現行'|'オリジナル' }) → string`
  - `parseFilterOptions(html: string) → meta.options`（「共通のデータ型」の `meta.json` のとおり。`products` の `order` は一覧の並び順から付ける）
  - `parseRightsNotice(html: string) → string`
  - `parseDetailPage(html: string, id: string) → Card`（`formats` は `[]`、`releaseOrder` は `0` のまま返す。Task 4 で付ける）

- [ ] **Step 1: テスト用の HTML を保存する。** 小さな一回きりのスクリプト（コミットしない）で、`createFetcher` を使って次を `scraper/test/fixtures/` に保存する：カード検索のトップ（`list-p1.html`）、2ページ目、最後のページ、フォーマット「現行」で絞った1ページ目、詳細ページを5種類（通常のクリーチャー、呪文（パワーなし）、ツインパクト、多色、パワーが `+` 付きか `∞`）。ブラウザで一覧ページを開き、ページ送りとフォーマットの絞り込みのときの URL（またはフォームの送信先とパラメータ）を記録し、`listPageUrl` の形を決める。**一覧が JavaScript で後から読み込まれている場合は、その読み込み先の URL を使う。**
- [ ] **Step 2: 失敗するテストを書く**
  - `parse-list`：`list-p1.html` から ID が1件以上取れ、どれも `/^[a-z0-9]+-[A-Za-z0-9]+$/` に合う。`hasNext` は1ページ目で true、最後のページで false。`parseFilterOptions` の `races` と `products` が空でない。`parseRightsNotice` が `©` を含む。
  - `parse-detail`：保存した5枚それぞれで、`name`・`type`・`civilizations`・`rarity` が空でない。呪文は `power === null`。`+` 付きは `power` が数字で `powerRaw` が元の文字列。ツインパクトは `twinpact` が null でなく、その `name` が表の面と違う。多色は `civilizations.length >= 2`。
- [ ] **Step 3:** `npx vitest run scraper/test/parse-*.test.js` → FAIL。
- [ ] **Step 4:** cheerio で実装する。数字の変換は `toNumberOrNull(raw: string): number|null`（全角数字は半角に直す。数字が取れなければ null）を `parse-detail.js` に置く。
- [ ] **Step 5:** 同じコマンド → PASS。
- [ ] **Step 6:** コミット `feat: parse official list and detail pages`

### Task 3: カードの検証と、進み具合の保存

**Files:**
- Create: `scraper/validate.js`, `scraper/state.js`
- Test: `scraper/test/validate.test.js`, `scraper/test/state.test.js`

**Interfaces:**
- Produces:
  - `validateCard(card: Card) → string[]`（問題の説明。空なら OK）。必須：`id`, `name`, `type`, `rarity`, `civilizations.length >= 1`。ツインパクトの面も同じ規則。
  - `loadState(path) → State`, `saveState(path, State)`。`State = { lastFullAt: string|null, lastIncrementalAt: string|null, full: null | { startedAt: string, pendingIds: string[], doneIds: string[] } }`。ファイルがなければ全部 null の State を返す。

- [ ] **Step 1: 失敗するテスト**：必須項目が欠けた Card で該当の説明が返る。正しい Card で `[]`。State を保存して読み直すと同じ内容。ファイルがないときの初期値。
- [ ] **Step 2:** `npx vitest run scraper/test/validate.test.js scraper/test/state.test.js` → FAIL。
- [ ] **Step 3:** 実装する。State の保存先は `scraper/state.json`（コミットする）。
- [ ] **Step 4:** 同じコマンド → PASS。
- [ ] **Step 5:** コミット `feat: validate cards and persist scrape state`

### Task 4: 読み取りの実行（auto / incremental / full）

**Files:**
- Create: `scraper/run.js`
- Test: `scraper/test/run.test.js`

**Interfaces:**
- Consumes: Task 1〜3 のすべて
- Produces: `runScrape({ mode, fetcher, now, paths, maxMinutes }) → Promise<{ action: 'none'|'incremental'|'full-progress'|'full-done', written: boolean }>`。コマンドとして `node scraper/run.js --mode=auto` で動く（終了コード：成功 0、検証エラーや取得失敗 1）。

動きの決まり：
- `auto`：`full` が進行中、または `lastFullAt` から30日以上 → full を続ける。そうでなく `lastIncrementalAt` から7日以上 → incremental。どちらでもなければ `none`。
- `incremental`：一覧ページを全部読んで ID を集め、`cards.json` にない ID だけ詳細を読む。フォーマット「現行」「オリジナル」の一覧も読み、全カードの `formats` を付け直す。`releaseOrder` は、一覧の並び（新しい順）から付ける。
- `full`：開始時に全 ID を `pendingIds` に入れ、詳細を読むたびに `scraper/.cache/full-cards.json` に追記し、`doneIds` に移す。`maxMinutes` に達したら State を保存して `full-progress` で終わる（`cards.json` は書かない）。全部終わったら、formats と releaseOrder を付けてから `cards.json` を丸ごと置き換え `full-done`。
- どのモードでも、`validateCard` で1件でも問題があれば、問題の一覧を表示して終了コード 1。`cards.json` と `meta.json` は書かない。
- 書き出すときは `meta.json` の `updatedAt`, `count`, `rightsNotice`, `options` も更新する。
- `.cache/` は GitHub Actions のキャッシュで次回に引き継ぐ（Task 10）。

- [ ] **Step 1: 失敗するテスト**（偽の fetcher で、保存した HTML を返す）
  - `test('auto: 何もする必要がないときは none で何も書かない')`
  - `test('incremental: 新しいIDだけ詳細を取得する')`：既存の cards.json にある ID の詳細 URL が呼ばれない。
  - `test('full: 時間切れで full-progress。cards.json は変わらず、次の実行で続きから再開する')`（Review Focus 5）
  - `test('検証エラーがあると終了コード1で何も書かない')`
  - `test('formats と releaseOrder が付く')`
- [ ] **Step 2:** `npx vitest run scraper/test/run.test.js` → FAIL。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** 同じコマンド → PASS。
- [ ] **Step 5: 本物で小さく試す。** `run.js` に `--limit=30`（詳細を30件だけ読む。開発用）を付けて実行し、`site/data/cards.json` に30件入ることを確認する。このファイルは画面づくりの見本データとしてコミットする。
- [ ] **Step 6:** コミット `feat: scrape runner with incremental and resumable full modes`

### Task 5: 外部リンク

**Files:**
- Create: `site/js/links.js`
- Test: `site/test/links.test.js`

**Interfaces:**
- Produces: `buildLinks(card: Card) → { official: string, mercari: string, kanabellBuy: string, kanabellSell: string, youtube: string }`、`imageUrl(id: string) → string`

- [ ] **Step 1: カーナベルの URL を決める。** ブラウザでカーナベルのデュエマ販売ページと買取ページを開き、カード名で検索したときの URL の形を記録して、`links.js` の冒頭にコメントで残す。
- [ ] **Step 2: 失敗するテスト**
  - `official` が `https://dm.takaratomy.co.jp/card/detail/?id=dm26ex5-SEC001CHO`
  - `mercari` が `https://jp.mercari.com/search?keyword=` + `encodeURIComponent(name)` + `&status=on_sale&sort=price&order=asc`
  - `youtube` が `https://www.youtube.com/results?search_query=` + `encodeURIComponent('デュエマ ' + name)`
  - 名前が `《ボルシャック・ドラゴン》／テスト ＆ A+B` のとき、どの URL も `new URL()` で解析でき、`searchParams` から元の文字列が戻る（Review Focus 1）
  - `imageUrl('dm26ex5-SEC001CHO')` が `https://dm.takaratomy.co.jp/wp-content/card/cardimage/dm26ex5-SEC001CHO.jpg`
- [ ] **Step 3:** `npx vitest run site/test/links.test.js` → FAIL。
- [ ] **Step 4:** 実装する。
- [ ] **Step 5:** → PASS。
- [ ] **Step 6:** コミット `feat: external link builders`

### Task 6: 絞り込み・並べ替え・同名まとめ

**Files:**
- Create: `site/js/filter.js`
- Test: `site/test/filter.test.js`

**Interfaces:**
- Produces: `defaultQuery() → Query`, `filterCards(cards: Card[], q: Query) → Card[]`（同名まとめ・並べ替えまで済ませた結果）, `matchesCard(card, q) → boolean`, `sortCards(cards, sort, order) → Card[]`, `groupSameName(cards) → Card[]`（同じ名前は releaseOrder が一番大きい1枚を残す）

決まり：
- 文字検索は、空白で区切った語をすべて含むもの（AND）。対象は名前・読み・能力・種族・フレーバー・イラストレーター。カタカナとひらがな、全角と半角の英数字は同じとみなす（`normalize(s)` を export）。
- 文明：`civMode` が `any` は選んだ文明のどれかを含む、`only` は選んだ文明以外を含まない、`all` は選んだ文明をすべて含む。`colorCount` で単色・多色を絞る。
- ツインパクトは、どちらかの面が条件に合えば当たり（Review Focus 2）。
- コスト・パワーの範囲を指定したとき、値が null のカードは外す。範囲を指定しないときは残す（Review Focus 3）。
- `keywords` は能力の文章にその語が含まれるかで判定する。
- 並べ替えで値が null のものは常に最後。同じ値なら releaseOrder の新しい順。

- [ ] **Step 1: 失敗するテスト**（10枚程度の手書きの Card で）：上の決まりそれぞれに1つずつ。加えて `test('24,000件で filterCards が 100ms 以内')`（同じ見本を複製して作る）。
- [ ] **Step 2:** `npx vitest run site/test/filter.test.js` → FAIL。
- [ ] **Step 3:** 実装する。
- [ ] **Step 4:** → PASS。
- [ ] **Step 5:** コミット `feat: card filtering, sorting and same-name grouping`

### Task 7: 絞り込み条件と URL のハッシュ

**Files:**
- Create: `site/js/query-url.js`
- Test: `site/test/query-url.test.js`

**Interfaces:**
- Consumes: Task 6 の `defaultQuery`
- Produces: `queryToHash(q: Query) → string`（初期値と同じ項目は書かない。先頭は `#`）, `hashToQuery(hash: string) → Query`（不正な値は初期値に戻す）

- [ ] **Step 1: 失敗するテスト**：初期値は `''` になる。日本語の文字検索・複数の文明・コスト範囲を含む Query を往復しても同じになる。`#cost=abc&civ=炎` のような不正な値で例外にならず、初期値に戻る。
- [ ] **Step 2:** `npx vitest run site/test/query-url.test.js` → FAIL。
- [ ] **Step 3:** `URLSearchParams` で実装する。
- [ ] **Step 4:** → PASS。
- [ ] **Step 5:** コミット `feat: query <-> url hash`

### Task 8: 一覧の表示（1枚のカードと、見えている範囲だけ描く一覧）

**Files:**
- Create: `site/js/card-tile.js`, `site/js/grid.js`
- Test: `site/test/card-tile.test.js`

**Interfaces:**
- Consumes: Task 5 の `imageUrl`
- Produces:
  - `renderTile(card: Card) → HTMLElement`：`<button class="tile" data-id>` の中に、`loading="lazy"` の `<img>`（alt はカード名）と、コストとカード名の1行。画像の `error` で `tile--text` クラスを付け、文字のカード（文明の色の帯、コスト、名前、パワー、種族）を表示する。
  - `createGrid(container: HTMLElement, { onSelect(card) }) → { setCards(cards: Card[]): void, setDensity(d: 1|2|3): void }`：行単位で、画面に見えている行と前後2行だけを DOM に置く。カードの縦横比は 63:88。`density` で1枚の幅を 72px / 96px / 128px にし、列数は幅から計算する。

- [ ] **Step 1: 失敗するテスト**（jsdom）：`renderTile` の img の src が `imageUrl(id)`。img に `error` を発火すると `tile--text` が付き、カード名とコストが文字で見える（Review Focus 4）。ツインパクトでは両方の面の名前が文字のカードに出る。
- [ ] **Step 2:** `npx vitest run site/test/card-tile.test.js --environment jsdom` → FAIL。
- [ ] **Step 3:** 実装する。`grid.js` はテストなしで、Task 9 で目で確認する。
- [ ] **Step 4:** → PASS。
- [ ] **Step 5:** コミット `feat: card tiles with text fallback and windowed grid`

### Task 9: 画面の組み立て（入力欄・詳細・フッター）

**Files:**
- Create: `site/index.html`, `site/style.css`, `site/js/controls.js`, `site/js/detail.js`, `site/js/app.js`

**Interfaces:**
- Consumes: Task 5〜8 のすべて、`site/data/cards.json`, `site/data/meta.json`
- Produces: 動くサイト

画面の決まり（設計書 第5章）：
- 上：文字検索、文明（6つのトグル）、コスト範囲、種類・種族・パックの選択、「詳細条件」で開く残り（レアリティ、パワー範囲、ツインパクト、フォーマット、特殊能力、イラストレーター、文明の条件、単色・多色）、並び順、一覧の大きさ（3段階）、「同名カードをまとめる」、件数。
- 条件を変えたら 150ms 待ってから絞り込み、URL のハッシュを更新する。ハッシュから開いたら、その条件で表示する。
- 詳細：PC（幅 900px 以上）は右側に固定、スマホは下から出る。中身は公式の画像（大）、名前、文明・コスト・パワー・マナ・種族・種類・レアリティ・能力・フレーバー・イラストレーター・収録商品、ツインパクトなら2つ目の面、ボタン5つ（「公式の詳細ページ」「メルカリ（販売中・安い順）」「カーナベル（販売）」「カーナベル（買取）」「YouTube で動画を探す」）。
- フッター：「非公式のファンサイトです。タカラトミー等とは関係ありません。」、`meta.rightsNotice`、問い合わせ先（`config` と同じ Gmail を `site/js/app.js` の定数 `CONTACT_EMAIL` に置く。TODO のときは表示しない）、データの更新日（`meta.updatedAt`）。
- 読み込み中は「カードデータを読み込んでいます」、読み込みに失敗したら「カードデータを読み込めませんでした。時間をおいて再読み込みしてください。」を表示する。
- ライトとダーク両方の配色。キーボードで一覧と詳細を操作できる（Tab で移動、Enter で選択、Esc で詳細を閉じる）。

- [ ] **Step 1:** 実装する。
- [ ] **Step 2: 目で確認する。** `npx serve site`（または同等の静的サーバー）で開き、Task 4 の30件の見本データで確認する：PC で1画面に40枚以上（見本を複製して200件にした一時データで確認）、スマホ幅（375px）で20枚以上見える。条件を変えると一覧とハッシュが変わる。ハッシュ付きの URL を開き直すと同じ条件になる。詳細のボタン5つが正しい先を新しいタブで開く。画像の URL をわざと壊すと文字のカードになる。
- [ ] **Step 3:** `npm test` → 全部 PASS。
- [ ] **Step 4:** コミット `feat: assemble viewer UI`

### Task 10: 自動更新（GitHub Actions）と手順書

**Files:**
- Create: `.github/workflows/update-cards.yml`, `docs/setup-guide.md`

**Interfaces:**
- Consumes: Task 4 の `node scraper/run.js --mode=auto`

ワークフローの決まり：
- `schedule: cron: '0 18 * * *'`（日本時間 毎日 3:00）と `workflow_dispatch`（手動実行）。
- `timeout-minutes: 350`。Node 20。`npm ci` → `npm test` → `node scraper/run.js --mode=auto`。
- `scraper/.cache/` を `actions/cache` で保存・復元する（キーに実行番号を入れ、`restore-keys` で前回のものを使う）。
- `site/data/` か `scraper/state.json` に変更があれば、`github-actions[bot]` としてコミットして push する。読み取りが終了コード 1 ならコミットしない（ジョブが失敗し、GitHub からユーザーにメールが届く）。
- `permissions: contents: write`。

手順書（`docs/setup-guide.md`、日本語、画面の操作を番号つきで）：
1. 専用 Gmail を作る。
2. `scraper/config.js` と `site/js/app.js` の TODO に、サイトの URL（Cloudflare Pages で決まるもの。先に Step 4 を行う）と Gmail を入れる。
3. GitHub のアカウントを作り、リポジトリを作って push する。
4. Cloudflare のアカウントを作り、Pages で GitHub のリポジトリをつなぐ（ビルドコマンドなし、出力ディレクトリ `site`）。
5. GitHub の Actions タブで「update-cards」を手動実行し、初回の全件読み取りが数日かけて終わるのを待つ（毎日続きから進む）。
6. 確認：サイトの件数が公式の表示とほぼ同じになったか。

- [ ] **Step 1:** ワークフローを書く。
- [ ] **Step 2:** 手元で `npx --yes @action-validator/cli .github/workflows/update-cards.yml`（または `actionlint`）で文法を確認 → エラーなし。
- [ ] **Step 3:** 手順書を書く。
- [ ] **Step 4:** コミット `chore: daily update workflow and setup guide`
