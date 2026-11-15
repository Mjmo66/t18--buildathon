// Small inline icons for navigation. name: home | search | user | chat | list | calendar | heart | qr | star.
const paths = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm5.5 12.5L21 21',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
  chat: 'M4 5h16v11H8l-4 4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] ?? paths.list} />
    </svg>
  );
}

/** Icon for a nav link: its own `icon` field, else a guess from the path. */
export function iconFor(link) {
  if (link.icon) return link.icon;
  const to = link.to;
  if (to.startsWith('/chat')) return 'chat';
  if (/^\/(user|charity)\/?$/.test(to)) return 'home';
  if (/profile|account/.test(to)) return 'user';
  if (/find|search|discover|charities|feed|match/.test(to)) return 'search';
  if (/shift|signup|calendar|schedule/.test(to)) return 'calendar';
  if (/check-?in|scan|qr/.test(to)) return 'qr';
  if (/reward|badge|points/.test(to)) return 'star';
  return 'list';
}
