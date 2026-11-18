// 公開前に、この2つをあなたのサイトの URL と専用 Gmail に書き換えてください。
// 書き換えるまで、読み取りプログラムは起動しません。
export const SITE_URL = 'https://de-card-viewer.pages.dev';
export const CONTACT_EMAIL = 'fengjinye87@gmail.com';

export const BASE_URL = 'https://dm.takaratomy.co.jp';
export const USER_AGENT = `DMCardViewer/1.0 (+${SITE_URL}; ${CONTACT_EMAIL})`;
export const MIN_INTERVAL_MS = 1000;
export const MAX_RUN_MINUTES = 330;

export function assertConfigured({ siteUrl = SITE_URL, contactEmail = CONTACT_EMAIL } = {}) {
  if (siteUrl.startsWith('TODO') || contactEmail.startsWith('TODO')) {
    throw new Error(
      'scraper/config.js の SITE_URL と CONTACT_EMAIL を設定してください（公式サイトに連絡先を伝えるためです）。',
    );
  }
}
