// Charity number rules (CONTRACT.md): normalise, check format, derive the register.

/** Upper case, no whitespace. */
export function normaliseCharityNumber(raw) {
  return String(raw ?? '').toUpperCase().replace(/\s+/g, '');
}

/** 'OSCR' | 'CCEW' | 'CCNI' for a normalised number, or null if the format is wrong. */
export function registerFor(number) {
  if (/^SC\d{6}$/.test(number)) return 'OSCR';
  if (/^NIC\d{6}$/.test(number)) return 'CCNI';
  if (/^\d{6,7}$/.test(number)) return 'CCEW';
  return null;
}

export const REGISTER_NAMES = {
  OSCR: 'Scottish Charity Regulator (OSCR)',
  CCEW: 'Charity Commission for England and Wales',
  CCNI: 'Charity Commission for Northern Ireland',
};

const FILLER = new Set(['the', 'and', 'of', 'for', 'ltd', 'limited', 'scio', 'cio', 'inc', 'co', 'company', 'plc']);
/** Words of an organisation name without case, punctuation and legal filler. */
export function nameWords(name) {
  const words = String(name ?? '').toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/);
  return new Set(words.filter((w) => w && !FILLER.has(w)));
}

/**
 * True when at least half of the longer name's words appear in the other name. Same rule as
 * charity_names_match() in the database, which decides verification; this one gives instant feedback.
 */
export function namesMatch(a, b) {
  const wa = nameWords(a);
  const wb = nameWords(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size) >= 0.5;
}

/** Register entry name or "known as" name matches. */
export const matchesRegistry = (name, entry) => Boolean(entry) && (namesMatch(name, entry.org_name) || namesMatch(name, entry.known_as));
