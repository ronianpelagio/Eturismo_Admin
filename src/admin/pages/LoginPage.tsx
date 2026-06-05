import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = { onLoggedIn: () => void; error?: string | null };

export default function LoginPage({ onLoggedIn, error }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthErr(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setAuthErr(err.message);
      return;
    }
    onLoggedIn();
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="admin-grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-white/[0.04] to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md rounded-3xl border border-border bg-card/90 p-8 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <div className="mb-7 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-background text-base font-bold tracking-tight">
            E
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">ETurismo</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Admin Console</div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sacred Heritage Collection · Administrator access only.
        </p>

        {(authErr || error) && (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive-foreground">
            {authErr || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@etorismo.com"
              className="h-10 rounded-xl border-border bg-muted/40 focus-visible:ring-1 focus-visible:ring-foreground/40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-xl border-border bg-muted/40 pr-10 focus-visible:ring-1 focus-visible:ring-foreground/40"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="h-10 w-full rounded-xl text-sm font-medium">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Web-only · Separated from mobile app
        </p>
      </motion.div>
    </main>
  );
}
