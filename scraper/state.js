import fs from 'node:fs';
import path from 'node:path';

/** @typedef {{ lastFullAt: string|null, lastIncrementalAt: string|null,
 *   full: null | { startedAt: string, pendingIds: string[], doneIds: string[] } }} State */

export const emptyState = () => ({ lastFullAt: null, lastIncrementalAt: null, full: null });

/** @returns {State} */
export function loadState(file) {
  if (!fs.existsSync(file)) return emptyState();
  return { ...emptyState(), ...JSON.parse(fs.readFileSync(file, 'utf8')) };
}

export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}
