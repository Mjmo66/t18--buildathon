// App icons: a name → lucide-react component map, so nav links can name their icon as a string.
import {
  Sparkles, CalendarCheck, CircleUserRound, MessagesSquare, LayoutDashboard, ClipboardList, Building2,
  SlidersHorizontal, Plus, House, Search, Calendar, HeartHandshake, QrCode, Star, LogOut, List, Award,
} from 'lucide-react';

const icons = {
  home: House,
  dashboard: LayoutDashboard,
  feed: Sparkles,
  search: Search,
  user: CircleUserRound,
  org: Building2,
  chat: MessagesSquare,
  list: List,
  requests: ClipboardList,
  calendar: Calendar,
  shifts: CalendarCheck,
  heart: HeartHandshake,
  qr: QrCode,
  star: Star,
  award: Award,
  prefs: SlidersHorizontal,
  plus: Plus,
  logout: LogOut,
};

export function Icon({ name, size = 20, strokeWidth = 1.75 }) {
  const C = icons[name] ?? icons.list;
  return <C size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
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
