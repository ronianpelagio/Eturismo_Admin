import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Boxes,
  Users,
  Megaphone,
  Calendar,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import type { PageKey } from '../navigation';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SidebarProps = {
  activePage: PageKey;
  onSelect: (page: PageKey) => void;
  email: string;
  collapsed: boolean;
  onToggle: () => void;
  onSignOut: () => void;
};

const NAV: Array<{ key: PageKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'artifacts', label: 'Artifacts', icon: Boxes },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'events', label: 'Events', icon: Calendar },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({
  activePage,
  onSelect,
  email,
  collapsed,
  onToggle,
  onSignOut,
}: SidebarProps) {
  const initial = (email?.[0] ?? 'A').toUpperCase();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 244 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-border bg-sidebar"
    >
      {/* Brand */}
      <div className={cn('flex h-14 items-center gap-2.5 border-b border-border px-3', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background text-[13px] font-bold tracking-tight">
          E
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">ETurismo</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">Admin</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className={cn('mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground', collapsed && 'sr-only')}>
          Workspace
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all',
                    active
                      ? 'bg-sidebar-accent text-foreground'
                      : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="active-pill"
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Divider */}
      <div className="mx-3 my-1 h-px bg-border" />

      {/* Collapse toggle */}
      <div className={cn('px-2.5 py-2', collapsed && 'flex justify-center')}>
        <button
          onClick={onToggle}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground',
            collapsed && 'h-8 w-8 justify-center p-0'
          )}
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* Profile */}
      <div className={cn('border-t border-border p-2.5', collapsed && 'flex justify-center')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-sidebar-accent',
                collapsed && 'w-auto justify-center'
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-foreground">
                {initial}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">{email || 'Admin'}</div>
                  <div className="truncate text-[10px] text-muted-foreground">Administrator</div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            className="w-56 rounded-2xl border-border bg-popover/95 backdrop-blur-xl"
          >
            <DropdownMenuLabel className="text-xs">
              <div className="truncate font-medium text-foreground">{email}</div>
              <div className="text-[10px] font-normal text-muted-foreground">Administrator</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSelect('settings')} className="text-sm">
              <Settings className="mr-2 h-3.5 w-3.5" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} className="text-sm">
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}
