import React, { useEffect, useState } from 'react';
import { Users, Boxes, Star, Calendar, Megaphone, RefreshCw } from 'lucide-react';
import { supabase } from '../services/supabase';
import PageHeader from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../components/LoadingSkeleton';

type LogEntry = {
  id: string;
  type: 'user' | 'artifact' | 'rating' | 'event' | 'announcement';
  title: string;
  subtitle?: string;
  created_at: string;
};

const TYPE_META: Record<LogEntry['type'], { icon: React.ReactNode; label: string; color: string }> = {
  user:         { icon: <Users className="h-3.5 w-3.5" />,        label: 'New User',         color: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
  artifact:     { icon: <Boxes className="h-3.5 w-3.5" />,        label: 'New Artifact',     color: 'bg-violet-500/10 text-violet-600 border-violet-200 dark:border-violet-800' },
  rating:       { icon: <Star className="h-3.5 w-3.5" />,         label: 'New Rating',       color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800' },
  event:        { icon: <Calendar className="h-3.5 w-3.5" />,     label: 'New Event',        color: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800' },
  announcement: { icon: <Megaphone className="h-3.5 w-3.5" />,   label: 'Announcement',     color: 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

async function fetchLogs(limit = 50): Promise<LogEntry[]> {
  const [users, artifacts, ratings, events, announcements] = await Promise.all([
    supabase.from('users').select('id, first_name, last_name, email, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('artifacts').select('id, name, category, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('user_ratings').select('id, rating, feedback, created_at, artifact_id, artifacts(name)').order('created_at', { ascending: false }).limit(limit),
    supabase.from('events').select('id, title, created_at').order('created_at', { ascending: false }).limit(limit),
    supabase.from('announcements').select('id, title, created_at').order('created_at', { ascending: false }).limit(limit),
  ]);

  const entries: LogEntry[] = [];

  for (const u of users.data || []) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
    entries.push({ id: `user-${u.id}`, type: 'user', title: name, subtitle: u.email, created_at: u.created_at });
  }
  for (const a of artifacts.data || []) {
    entries.push({ id: `artifact-${a.id}`, type: 'artifact', title: a.name, subtitle: a.category, created_at: a.created_at });
  }
  for (const r of (ratings.data || []) as any[]) {
    const artifactName = r.artifacts?.name || r.artifact_id;
    entries.push({
      id: `rating-${r.id}`, type: 'rating',
      title: `${r.rating}★ on ${artifactName}`,
      subtitle: r.feedback ? r.feedback.slice(0, 80) : undefined,
      created_at: r.created_at,
    });
  }
  for (const e of events.data || []) {
    entries.push({ id: `event-${e.id}`, type: 'event', title: e.title, created_at: e.created_at });
  }
  for (const a of announcements.data || []) {
    entries.push({ id: `ann-${a.id}`, type: 'announcement', title: a.title, created_at: a.created_at });
  }

  return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export default function RecentLogsPage() {
  const [logs, setLogs]       = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<LogEntry['type'] | 'all'>('all');

  const load = async () => {
    setLoading(true); setError(null);
    try {
      setLogs(await fetchLogs(50));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const displayed = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  const counts = logs.reduce((acc, l) => { acc[l.type] = (acc[l.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Recent Logs"
        description="Latest activity across users, artifacts, ratings, events, and announcements."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="rounded-xl">
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(Object.keys(TYPE_META) as LogEntry['type'][]).map(t => (
          <Card key={t} className="rounded-xl border-border bg-card cursor-pointer hover:bg-muted/40 transition"
            onClick={() => setFilter(filter === t ? 'all' : t)}>
            <CardContent className="flex items-center gap-2 p-3">
              <span className={`rounded-lg border p-1.5 ${TYPE_META[t].color}`}>{TYPE_META[t].icon}</span>
              <div>
                <div className="text-xs font-semibold text-foreground">{counts[t] ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">{TYPE_META[t].label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', ...Object.keys(TYPE_META)] as const).map(t => (
          <button key={t} onClick={() => setFilter(t as any)}
            className={`rounded-full border px-3 py-1 text-xs transition
              ${filter === t ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'}`}>
            {t === 'all' ? `All (${logs.length})` : `${TYPE_META[t as LogEntry['type']].label} (${counts[t] ?? 0})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">{error}</div>
      )}

      <Card className="rounded-2xl border-border bg-card">
        {loading ? (
          <div className="space-y-0 divide-y divide-border p-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-48 rounded" />
                  <Skeleton className="h-2.5 w-32 rounded" />
                </div>
                <Skeleton className="h-2.5 w-12 rounded" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No activity yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {displayed.map(entry => {
              const meta = TYPE_META[entry.type];
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition">
                  <span className={`mt-0.5 shrink-0 rounded-lg border p-1.5 ${meta.color}`}>{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`rounded-full border text-[9px] px-1.5 py-0 ${meta.color}`}>{meta.label}</Badge>
                      <span className="truncate text-sm font-medium text-foreground">{entry.title}</span>
                    </div>
                    {entry.subtitle && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.subtitle}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(entry.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
