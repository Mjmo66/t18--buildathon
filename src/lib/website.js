// Charity website links: normalised before saving, checked again before rendering a link.

export const WEBSITE_MAX = 200;
export const ABOUT_MAX = 1000;

/** "example.org" → "https://example.org"; '' → null; throws a readable Error for anything else. */
export function normaliseWebsite(raw) {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  let url;
  try { url = new URL(withScheme); } catch { throw new Error('Enter a website address like example.org.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) {
    throw new Error('Enter a website address like example.org.');
  }
  const out = url.href;
  if (out.length > WEBSITE_MAX) throw new Error(`Website address is too long (max ${WEBSITE_MAX} characters).`);
  return out;
}

/** The URL to put in an <a href>, or null when it is not a plain http(s) link. */
export function safeWebsite(raw) {
  try { return raw ? normaliseWebsite(raw) : null; } catch { return null; }
}

/** "https://www.example.org/about" → "example.org/about" for display. */
export function displayWebsite(href) {
  return href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}
