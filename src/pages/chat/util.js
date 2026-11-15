// Small helpers shared by the chat pages.
import { format, isToday, isYesterday } from 'date-fns';

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

export function dayLabel(date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE d MMM yyyy');
}

/** Insert messages, de-duplicated by id, oldest first. */
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
