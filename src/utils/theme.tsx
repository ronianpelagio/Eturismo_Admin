import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'admin:theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return (v as Theme) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    const root = document.documentElement;

    const apply = (t: Theme) => {
      const effective =
        t === 'system'
          ? window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : t;

      if (effective === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };

    apply(theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}

    // listen to system preference changes when using 'system'
    const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') apply('system');
    };
    if (mql && mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql && (mql as any).addListener) (mql as any).addListener(onChange);

    return () => {
      if (mql && mql.removeEventListener) mql.removeEventListener('change', onChange);
      else if (mql && (mql as any).removeListener) (mql as any).removeListener(onChange);
    };
  }, [theme]);

  const toggle = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
