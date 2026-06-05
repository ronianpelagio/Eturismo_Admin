import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  icon?: React.ReactNode;
  loading?: boolean;
};

export default function StatCard({ label, value, delta, trend = 'flat', icon, loading }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-foreground/30 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_20px_40px_-20px_rgba(0,0,0,0.5)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
            {loading ? <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" /> : value}
          </div>
          {delta && !loading && (
            <div
              className={cn(
                'text-[11px] font-medium',
                trend === 'up' && 'text-foreground',
                trend === 'down' && 'text-muted-foreground',
                trend === 'flat' && 'text-muted-foreground'
              )}
            >
              {delta}
            </div>
          )}
        </div>
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-foreground/80">
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
