import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Boxes,
  Star,
  Headphones,
  Activity,
  Plus,
  Megaphone,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { CardSkeleton, Skeleton } from '../components/LoadingSkeleton';
import {
  AdminUser,
  DashboardDemographics as DashboardDemographicsType,
  DashboardStats,
} from '../types';
import { fetchDashboardStats, fetchUserDemographics } from './dashboardData';
import { useTheme } from '@/utils/theme';

const defaultStats: DashboardStats = {
  artifacts: 0,
  users: 0,
  activeUsers: 0,
  blockedUsers: 0,
  reviews: 0,
  liveStatus: 'offline',
  totalVisitors: 0,
  scannedArtifacts: 0,
  audioPlays: 0,
  averageRating: 0,
  visitorsTrend: [],
};

const defaultDemographics: DashboardDemographicsType = {
  gender: { male: 0, female: 0, other: 0, unknown: 0 },
  ageGroups: { '13-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45-54': 0, '55-64': 0, '65+': 0, unknown: 0 },
  locations: {},
};

type DashboardPageProps = { profile: AdminUser };

export default function DashboardPage({ profile }: DashboardPageProps) {
  const [stats, setStats] = useState(defaultStats);
  const [demographics, setDemographics] = useState<DashboardDemographicsType>(defaultDemographics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, d] = await Promise.all([fetchDashboardStats(), fetchUserDemographics()]);
        if (!mounted) return;
        setStats(s);
        setDemographics(d);
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Unable to load dashboard.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const chartData = stats.visitorsTrend.map((p) => ({
    date: p.date.slice(5),
    visitors: p.count,
  }));

  const { theme } = useTheme();

  const chartColors =
    theme === 'dark'
      ? {
          stroke: '#F2F2F2',
          grid: 'rgba(255,255,255,0.06)',
          text: '#E6E6E6',
          tooltipBg: 'rgba(6,6,6,0.9)',
          tooltipBorder: 'rgba(255,255,255,0.12)',
          cursor: 'rgba(255,255,255,0.06)',
        }
      : {
          stroke: '#0f172a',
          grid: 'rgba(15,23,42,0.06)',
          text: '#0f172a',
          tooltipBg: '#ffffff',
          tooltipBorder: 'rgba(15,23,42,0.06)',
          cursor: 'rgba(15,23,42,0.06)',
        };

  const ageData = Object.entries(demographics.ageGroups).map(([k, v]) => ({ label: k, value: v }));
  const ageTotal = ageData.reduce((s, x) => s + x.value, 0);
  const genderTotal = Object.values(demographics.gender).reduce((s, n) => s + n, 0);
  const topLocations = Object.entries(demographics.locations).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const locationTotal = topLocations.reduce((s, [, n]) => s + n, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={`Welcome Admin${profile?.email ? `, ${profile.first_name.split('@')[0]}` : ''}`}
        description="A snapshot of visitors, content, and engagement across the collection."
        actions={
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                stats.liveStatus === 'live' ? 'bg-foreground' : 'bg-muted-foreground'
              }`}
            />
            {stats.liveStatus === 'live' ? 'Live now' : 'Offline'}
          </Badge>
        }
      />

      {error && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive-foreground">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Visitors"
          value={stats.totalVisitors.toLocaleString()}
          delta="All-time accounts"
          icon={<Users className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Artifacts"
          value={stats.artifacts.toLocaleString()}
          delta={`${stats.scannedArtifacts} with QR`}
          icon={<Boxes className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Audio Plays"
          value={stats.audioPlays.toLocaleString()}
          delta="Guided tours"
          icon={<Headphones className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Avg. Rating"
          value={stats.averageRating ? stats.averageRating.toFixed(1) : '—'}
          delta={`${stats.reviews} reviews`}
          icon={<Star className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Visitor trend */}
        <Card className="lg:col-span-2 rounded-2xl border-border bg-card">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last 7 days</div>
              <CardTitle className="mt-0.5 text-base font-semibold">Visitor trend</CardTitle>
            </div>
            <Badge variant="outline" className="rounded-full border-border text-[10px] text-muted-foreground">
              <Activity className="mr-1 h-3 w-3" /> Realtime
            </Badge>
          </CardHeader>
          <CardContent className="h-[220px] px-2 pb-2">
            {loading ? (
              <Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartColors.stroke} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartColors.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: chartColors.text, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ stroke: chartColors.cursor, strokeDasharray: '3 3' }}
                    contentStyle={{
                      background: chartColors.tooltipBg,
                      border: `1px solid ${chartColors.tooltipBorder}`,
                      borderRadius: 12,
                      color: chartColors.text,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="visitors" stroke={chartColors.stroke} strokeWidth={2} fill="url(#visGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shortcuts</div>
            <CardTitle className="mt-0.5 text-base font-semibold">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <QuickAction icon={<Plus className="h-3.5 w-3.5" />} label="Add artifact" hint="Inventory" />
            <QuickAction icon={<Megaphone className="h-3.5 w-3.5" />} label="New announcement" hint="Visitor news" />
            <QuickAction icon={<Calendar className="h-3.5 w-3.5" />} label="Schedule event" hint="Programming" />
            <QuickAction icon={<Users className="h-3.5 w-3.5" />} label="Invite admin" hint="Access" />
          </CardContent>
        </Card>
      </div>

      {/* Demographics row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Gender</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : (
              <DistributionBars
                rows={[
                  { label: 'Male', value: demographics.gender.male, total: genderTotal },
                  { label: 'Female', value: demographics.gender.female, total: genderTotal },
                  { label: 'Other', value: demographics.gender.other, total: genderTotal },
                  { label: 'Unknown', value: demographics.gender.unknown, total: genderTotal },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Age groups</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : (
              <DistributionBars
                rows={ageData.map((r) => ({ label: r.label, value: r.value, total: ageTotal }))}
                compact
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top locations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : topLocations.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No location data yet</p>
            ) : (
              <DistributionBars
                rows={topLocations.map(([label, value]) => ({ label, value, total: locationTotal }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
  return (
    <motion.button
      whileHover={{ x: 2 }}
      className="group flex w-full items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left transition hover:border-foreground/30 hover:bg-muted/60"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-foreground">
          {icon}
        </div>
        <div>
          <div className="text-xs font-medium text-foreground">{label}</div>
          <div className="text-[10px] text-muted-foreground">{hint}</div>
        </div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground" />
    </motion.button>
  );
}

function DistributionBars({
  rows,
  compact,
}: {
  rows: Array<{ label: string; value: number; total: number }>;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
      {rows.map((r) => {
        const pct = r.total ? Math.round((r.value / r.total) * 100) : 0;
        return (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="tabular-nums font-medium text-foreground">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="h-full rounded-full bg-foreground"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
