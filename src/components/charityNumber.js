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
