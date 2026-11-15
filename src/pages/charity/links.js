// Navigation links for the charity space. tab: false = sidebar only; hint: optional desktop tooltip;
// account: true = shown as the account button at the foot of the sidebar, not in the list.
export const charityLinks = [
  { to: '/charity', label: 'Home', icon: 'home' },
  { to: '/charity/requests', label: 'My requests', icon: 'requests' },
  { to: '/charity/requests/new', label: 'Ask for volunteers', icon: 'plus', tab: false },
  { to: '/charity/profile', label: 'Account', icon: 'settings', account: true },
];
