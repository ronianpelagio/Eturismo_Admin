export const navPages = [
  'dashboard',
  'artifacts',
  'users',
  'announcements',
  'events',
  'settings',
] as const;

export type PageKey = (typeof navPages)[number];

export const pageTitleMap: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  artifacts: 'Artifacts',
  users: 'Users',
  announcements: 'Announcements',
  events: 'Events',
  settings: 'Settings',
};
