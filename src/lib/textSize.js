// Text size chosen in Account. Kept on this device (like the system text size), applied as
// <html data-text-size>; index.css maps it to the root font size, and rem-based layout follows.
// index.html applies the saved value before first paint so the page does not jump.

export const TEXT_SIZES = [
  { id: 'small', label: 'Small', px: 14 },
  { id: 'standard', label: 'Standard', px: 16 },
  { id: 'large', label: 'Large', px: 18 },
  { id: 'xlarge', label: 'Extra large', px: 20 },
];
export const DEFAULT_TEXT_SIZE = 'standard';
const KEY = 'kindred:text-size';

const known = (id) => TEXT_SIZES.some((s) => s.id === id);

export function getTextSize(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(KEY);
    return known(v) ? v : DEFAULT_TEXT_SIZE;
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

export function applyTextSize(id, root = globalThis.document?.documentElement) {
  if (!root) return;
  if (id === DEFAULT_TEXT_SIZE || !known(id)) delete root.dataset.textSize;
  else root.dataset.textSize = id;
}

export function setTextSize(id, storage = globalThis.localStorage) {
  if (!known(id)) return;
  try {
    if (id === DEFAULT_TEXT_SIZE) storage?.removeItem(KEY);
    else storage?.setItem(KEY, id);
  } catch { /* private mode: still applies for this visit */ }
  applyTextSize(id);
}
