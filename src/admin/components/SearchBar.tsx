import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, Loader2,
  Package, Users, CalendarDays, Megaphone, Headphones,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '../services/supabase';
import { type PageKey } from '../navigation';

// ─── types ────────────────────────────────────────────────────────────────────

type ResultKind = 'artifact' | 'user' | 'event' | 'announcement' | 'audio_guide';

interface Result {
  id: string;
  kind: ResultKind;
  primary: string;
  secondary: string;
  page: PageKey;         // which admin page to navigate to
  artifactId?: string;   // for audio_guide → artifacts page
}

// ─── config ───────────────────────────────────────────────────────────────────

const KIND_META: Record<ResultKind, { icon: React.ElementType; label: string; color: string }> = {
  artifact:     { icon: Package,      label: 'Artifact',     color: 'text-violet-500'  },
  user:         { icon: Users,        label: 'User',         color: 'text-blue-500'    },
  event:        { icon: CalendarDays, label: 'Event',        color: 'text-amber-500'   },
  announcement: { icon: Megaphone,    label: 'Announcement', color: 'text-rose-500'    },
  audio_guide:  { icon: Headphones,   label: 'Audio Guide',  color: 'text-emerald-500' },
};

const ORDER: ResultKind[] = ['artifact', 'user', 'event', 'announcement', 'audio_guide'];

// ─── debounce ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── search fn ────────────────────────────────────────────────────────────────

async function globalSearch(q: string): Promise<Result[]> {
  const like = `%${q}%`;
  const results: Result[] = [];

  const [artifacts, users, events, announcements, audioGuides] = await Promise.all([
    supabase
      .from('artifacts')
      .select('id, name, category, creator')
      .or(`name.ilike.${like},category.ilike.${like},creator.ilike.${like},description.ilike.${like}`)
      .limit(5),
    supabase
      .from('users')
      .select('id, first_name, last_name, email, role')
      .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like}`)
      .limit(5),
    supabase
      .from('events')
      .select('id, title, event_datetime')
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(4),
    supabase
      .from('announcements')
      .select('id, title, announcement_datetime')
      .or(`title.ilike.${like},description.ilike.${like}`)
      .limit(4),
    supabase
      .from('audio_guides')
      .select('id, artifact_name, artifact_id')
      .ilike('artifact_name', like)
      .limit(4),
  ]);

  for (const row of artifacts.data ?? []) {
    results.push({
      id: row.id, kind: 'artifact', page: 'artifacts',
      primary: row.name,
      secondary: [row.category, row.creator].filter(Boolean).join(' · '),
    });
  }
  for (const row of users.data ?? []) {
    results.push({
      id: row.id, kind: 'user', page: 'users',
      primary: `${row.first_name} ${row.last_name}`,
      secondary: `${row.email} · ${row.role}`,
    });
  }
  for (const row of events.data ?? []) {
    results.push({
      id: row.id, kind: 'event', page: 'events',
      primary: row.title,
      secondary: row.event_datetime ? new Date(row.event_datetime).toLocaleString() : '',
    });
  }
  for (const row of announcements.data ?? []) {
    results.push({
      id: row.id, kind: 'announcement', page: 'announcements',
      primary: row.title,
      secondary: row.announcement_datetime ? new Date(row.announcement_datetime).toLocaleString() : '',
    });
  }
  for (const row of audioGuides.data ?? []) {
    results.push({
      id: row.id, kind: 'audio_guide', page: 'artifacts',
      primary: row.artifact_name ?? 'Audio Guide',
      secondary: 'Audio Guide',
      artifactId: row.artifact_id,
    });
  }

  return results.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

// ─── highlight ────────────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-foreground/15 px-0.5 text-foreground not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── result row ───────────────────────────────────────────────────────────────

function ResultRow({
  result, query, active, onClick,
}: {
  result: Result; query: string; active: boolean; onClick: () => void;
}) {
  const { icon: Icon, label, color } = KIND_META[result.kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
        active ? 'bg-muted/60' : 'hover:bg-muted/40'
      )}
    >
      <div className={cn('shrink-0', color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">
          <Highlight text={result.primary} query={query} />
        </p>
        {result.secondary && (
          <p className="truncate text-[10px] text-muted-foreground">
            <Highlight text={result.secondary} query={query} />
          </p>
        )}
      </div>
      <span className="shrink-0 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </button>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

type SearchBarProps = {
  className?: string;
  onNavigate: (page: PageKey) => void;
};

export default function SearchBar({ className, onNavigate }: SearchBarProps) {
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<Result[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const containerRef              = useRef<HTMLDivElement>(null);
  const debounced                 = useDebounce(query, 280);

  useEffect(() => {
    if (debounced.trim().length < 2) { setResults([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    globalSearch(debounced.trim()).then((r) => {
      if (cancelled) return;
      setResults(r); setOpen(true); setActiveIdx(-1); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debounced]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || results.length === 0) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
      else if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault();
        onNavigate(results[activeIdx].page);
        setOpen(false); setQuery('');
      } else if (e.key === 'Escape') { setOpen(false); }
    },
    [open, results, activeIdx, onNavigate]
  );

  const handleSelect = (result: Result) => {
    onNavigate(result.page);
    setOpen(false); setQuery('');
    inputRef.current?.blur();
  };

  const clear = () => { setQuery(''); setResults([]); setOpen(false); inputRef.current?.focus(); };

  const grouped = ORDER.reduce<{ kind: ResultKind; items: Result[] }[]>((acc, kind) => {
    const items = results.filter((r) => r.kind === kind);
    if (items.length) acc.push({ kind, items });
    return acc;
  }, []);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        {loading
          ? <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          : <Search  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        }
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search artifacts, users, events…"
          className="h-9 rounded-xl border-border bg-muted/40 pl-9 pr-8 text-sm placeholder:text-muted-foreground/70 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-foreground/40"
        />
        {query && (
          <button type="button" onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-xl backdrop-blur-xl"
          >
            {results.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-8 text-muted-foreground">
                <Search className="h-5 w-5 opacity-30" />
                <p className="text-xs">No results for "{debounced}"</p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto py-1">
                {grouped.map(({ kind, items }) => {
                  const { label, icon: Icon, color } = KIND_META[kind];
                  return (
                    <div key={kind}>
                      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2.5">
                        <Icon className={cn('h-3 w-3', color)} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {label}s
                        </span>
                      </div>
                      {items.map((r) => (
                        <ResultRow
                          key={r.id}
                          result={r}
                          query={debounced}
                          active={results.indexOf(r) === activeIdx}
                          onClick={() => handleSelect(r)}
                        />
                      ))}
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t border-border px-3 py-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''}</span>
                  <span className="text-[10px] text-muted-foreground">↑↓ navigate · ↵ open · esc close</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}