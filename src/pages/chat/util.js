// Small helpers shared by the chat pages.
import { formatDay } from '../../components/format.js';

export function initials(name) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
  return letters.toUpperCase();
}

export function hueOf(text) {
  let h = 0;
  for (const ch of text || '') h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

/** "Today", "Yesterday" or "Thursday 19 November". */
export function dayLabel(date) {
  return formatDay(date);
}

/** Insert messages, de-duplicated by id, oldest first. */
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
