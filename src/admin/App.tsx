import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from './services/supabase';
import { AdminUser } from './types';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ArtifactsPage from './pages/ArtifactsPage';
import UsersPage from './pages/UsersPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import EventsPage from './pages/EventsPage';
import SettingsPage from './pages/SettingsPage';
import SearchBar from './components/SearchBar';
import NotificationDropdown from './components/NotificationDropdown';
import { ChevronRight, Loader2, Menu, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ThemeProvider, useTheme } from '@/utils/theme';
import { navPages, pageTitleMap, type PageKey } from './navigation';

// ─── ThemeToggle outside App so hooks are never conditionally called ──────────

function ThemeToggle() {
  try {
    const { theme, toggle } = useTheme();
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={toggle}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    );
  } catch {
    return null;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<AdminUser | null>(null);
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setSession(data.session);
          await loadProfile(data.session.user.id);
        }
      } catch (err: any) {
        setError(err?.message || 'Unable to restore session');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_: string, newSession: any) => {
      setSession(newSession);
      if (newSession?.user) loadProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (data) setProfile(data as AdminUser);
    else setProfile(null);
  };

  const handleLoginSuccess = async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      setSession(data.session);
      await loadProfile(data.session.user.id);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  // Load Inter font once
  useEffect(() => {
    if (document.getElementById('admin-inter-font')) return;
    const link = document.createElement('link');
    link.id = 'admin-inter-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  if (loading) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading admin panel…
        </div>
      </Shell>
    );
  }

  if (!session || !profile) {
    return (
      <Shell>
        <LoginPage onLoggedIn={handleLoginSuccess} error={error} />
      </Shell>
    );
  }

  if (profile.role !== 'admin') {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground">Access denied</h2>
            <p className="mt-2 text-sm text-muted-foreground">This area is restricted to administrators.</p>
            <Button onClick={handleSignOut} variant="outline" className="mt-5 rounded-xl">
              Sign out
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  const handleSelect = (page: PageKey) => {
    setActivePage(page);
    setMobileNavOpen(false);
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':     return <DashboardPage profile={profile} />;
      case 'artifacts':     return <ArtifactsPage />;
      case 'users':         return <UsersPage />;
      case 'announcements': return <AnnouncementsPage />;
      case 'events':        return <EventsPage />;
      case 'settings':      return <SettingsPage />;
    }
  };

  return (
    <Shell>
      <div className="flex min-h-screen w-full">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar
            activePage={activePage}
            onSelect={handleSelect}
            email={profile.email}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
            onSignOut={handleSignOut}
          />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 border-r border-border bg-sidebar p-0 [&>button]:hidden">
            <Sidebar
              activePage={activePage}
              onSelect={handleSelect}
              email={profile.email}
              collapsed={false}
              onToggle={() => setMobileNavOpen(false)}
              onSignOut={handleSignOut}
            />
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Sticky top bar */}
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 rounded-xl"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>

            <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <span>Admin</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-medium text-foreground">{pageTitleMap[activePage]}</span>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <SearchBar
                className="hidden w-64 md:block"
                onNavigate={handleSelect}
              />
              <ThemeToggle />
              <NotificationDropdown />
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="admin-scope min-h-screen bg-background text-foreground antialiased">{children}</div>
    </ThemeProvider>
  );
}

export { navPages };
export type { PageKey };