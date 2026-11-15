import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEXT_SIZES, DEFAULT_TEXT_SIZE, getTextSize, setTextSize, applyTextSize } from './textSize.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('a saved size comes back; unknown or missing values fall back to the default', () => {
  const s = memory();
  assert.equal(getTextSize(s), DEFAULT_TEXT_SIZE);
  setTextSize('large', s);
  assert.equal(getTextSize(s), 'large');
  s.setItem('kindred:text-size', 'huge');
  assert.equal(getTextSize(s), DEFAULT_TEXT_SIZE);
  assert.equal(getTextSize({ getItem: () => { throw new Error('blocked'); } }), DEFAULT_TEXT_SIZE);
});

test('the default size leaves no attribute; others set data-text-size', () => {
  const root = { dataset: {} };
  applyTextSize('xlarge', root);
  assert.equal(root.dataset.textSize, 'xlarge');
  applyTextSize(DEFAULT_TEXT_SIZE, root);
  assert.equal(root.dataset.textSize, undefined);
});

test('every non-default size has a CSS rule and is applied early by index.html', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  for (const { id } of TEXT_SIZES.filter((s) => s.id !== DEFAULT_TEXT_SIZE)) {
    assert.match(css, new RegExp(`html\\[data-text-size='${id}'\\]`), id);
    assert.match(html, new RegExp(`'${id}'`), id);
  }
});
