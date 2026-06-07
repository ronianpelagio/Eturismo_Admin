export const navPages = [
  'dashboard',
  'artifacts',
  'users',
  'announcements',
  'events',
  'recent-logs',
  'settings',
] as const;

export type PageKey = (typeof navPages)[number];

export const pageTitleMap: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  artifacts: 'Artifacts',
  users: 'Users',
  announcements: 'Announcements',
  events: 'Events',
  'recent-logs': 'Recent Logs',
  settings: 'Settings',
};
