import { test, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadState, saveState, emptyState } from '../state.js';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dmstate-')), 'state.json');

test('ファイルがなければ初期値', () => {
  expect(loadState(tmp())).toEqual({ lastFullAt: null, lastIncrementalAt: null, full: null });
  expect(emptyState()).toEqual({ lastFullAt: null, lastIncrementalAt: null, full: null });
});

test('保存して読み直すと同じ内容', () => {
  const p = tmp();
  const s = {
    lastFullAt: '2026-11-01T00:00:00.000Z',
    lastIncrementalAt: null,
    full: { startedAt: '2026-11-17T00:00:00.000Z', pendingIds: ['a-1', 'b-2'], doneIds: ['c-3'] },
  };
  saveState(p, s);
  expect(loadState(p)).toEqual(s);
});
