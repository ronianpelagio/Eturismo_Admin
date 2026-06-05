import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Check, Star, UserPlus, Headphones, X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '../services/supabase';

// ─── types ────────────────────────────────────────────────────────────────────

type NotifKind = 'rating' | 'new_user' | 'audio_guide';

interface Notif {
  id: string;
  kind: NotifKind;
  title: string;
  detail: string;
  time: Date;
  read: boolean;
}

// ─── config ───────────────────────────────────────────────────────────────────

const KIND_META: Record<NotifKind, { icon: React.ElementType; color: string; bg: string }> = {
  rating:     { icon: Star,       color: 'text-amber-500',  bg: 'bg-amber-500/10'  },
  new_user:   { icon: UserPlus,   color: 'text-blue-500',   bg: 'bg-blue-500/10'   },
  audio_guide:{ icon: Headphones, color: 'text-emerald-500',bg: 'bg-emerald-500/10'},
};

const MAX_NOTIFS = 30;

// ─── helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return `${diff}s`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ─── item component ───────────────────────────────────────────────────────────

function NotifItem({ n, onDismiss }: { n: Notif; onDismiss: (id: string) => void }) {
  const { icon: Icon, color, bg } = KIND_META[n.kind];
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'group relative flex items-start gap-3 px-3 py-2.5 transition-colors',
        'hover:bg-muted/40',
        !n.read && 'bg-muted/20'
      )}
    >
      {/* unread indicator */}
      {!n.read && (
        <span className="absolute left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-foreground" />
      )}

      {/* kind icon */}
      <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', bg)}>
        <Icon className={cn('h-3.5 w-3.5', color)} />
      </div>

      {/* text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-xs font-semibold', n.read ? 'text-foreground/60' : 'text-foreground')}>
            {n.title}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {relativeTime(n.time)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.detail}</p>
      </div>

      {/* dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}
        className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        title="Dismiss"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted">
          <X className="h-2.5 w-2.5 text-muted-foreground" />
        </span>
      </button>
    </motion.div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function NotificationDropdown() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open,   setOpen]   = useState(false);
  const channelRef          = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const push = (n: Omit<Notif, 'id' | 'time' | 'read'>) =>
    setNotifs((prev) =>
      [{ ...n, id: uid(), time: new Date(), read: false }, ...prev].slice(0, MAX_NOTIFS)
    );

  // ── real-time subscriptions matched to your schema ────────────────────────
  useEffect(() => {
    const ch = supabase
      .channel('admin-notifications')

      // 1. New user registered — public.users INSERT
      //    Columns: first_name, last_name, email, role
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'users' },
        (payload: any) => {
          const row = payload.new as {
            first_name: string;
            last_name: string;
            email: string;
            role: string;
          };
          push({
            kind:   'new_user',
            title:  'New user registered',
            detail: `${row.first_name} ${row.last_name} · ${row.email}`,
          });
        }
      )

      // 2. Rating submitted — public.user_ratings INSERT
      //    Columns: rating (1-5), feedback, artifact_id
      //    Async-fetches artifact name for a nicer message
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_ratings' },
        async (payload: any) => {
          const row = payload.new as {
            rating: number;
            feedback: string | null;
            artifact_id: string;
          };

          const { data } = await supabase
            .from('artifacts')
            .select('name')
            .eq('id', row.artifact_id)
            .single();

          const stars   = '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating);
          const artName = data?.name ?? 'an artifact';
          const snippet = row.feedback
            ? ` — "${row.feedback.slice(0, 40)}${row.feedback.length > 40 ? '…' : ''}"`
            : '';

          push({
            kind:   'rating',
            title:  'New rating received',
            detail: `${stars} on "${artName}"${snippet}`,
          });
        }
      )

      // 3. Audio guide added — public.audio_guides INSERT
      //    Columns: artifact_name, artifact_id, audio_url
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audio_guides' },
        (payload: any) => {
          const row = payload.new as {
            artifact_name: string | null;
            artifact_id: string | null;
          };
          push({
            kind:   'audio_guide',
            title:  'Audio guide added',
            detail: `"${row.artifact_name ?? 'Unknown artifact'}"`,
          });
        }
      )

      .subscribe();

    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, []);

  // mark all read when panel opens
  useEffect(() => {
    if (open) {
      setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }, [open]);

  const unread      = notifs.filter((n) => !n.read).length;
  const markAllRead = () => setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  const dismiss     = (id: string) => setNotifs((prev) => prev.filter((n) => n.id !== id));
  const clearAll    = () => setNotifs([]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl border border-border bg-muted/30 hover:bg-muted/60"
        >
          <Bell className="h-4 w-4" />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background"
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 overflow-hidden rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notifications
            </span>
            {unread > 0 && (
              <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[9px] font-bold text-background">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground/70 hover:text-foreground"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
            {notifs.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[10px] text-muted-foreground hover:text-destructive"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* list */}
        <div className="max-h-[400px] overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-6 w-6 opacity-20" />
              <p className="text-xs font-medium">All caught up</p>
              <p className="text-[10px] opacity-50">New activity will appear here in real time</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {notifs.map((n) => (
                <NotifItem key={n.id} n={n} onDismiss={dismiss} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* footer */}
        {notifs.length > 0 && (
          <div className="border-t border-border px-3 py-2 text-center">
            <span className="text-[10px] text-muted-foreground">
              {notifs.length} notification{notifs.length !== 1 ? 's' : ''} · live
            </span>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}