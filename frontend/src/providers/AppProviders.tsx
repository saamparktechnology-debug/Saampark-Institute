'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => undefined,
  setTheme: () => undefined,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

function applyThemeToDom(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(mode);
  root.setAttribute('data-theme', mode);
  root.style.colorScheme = mode;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('argon_lms_theme') as ThemeMode | null;
      const initial: ThemeMode = saved === 'light' || saved === 'dark' ? saved : 'dark';
      setThemeState(initial);
      applyThemeToDom(initial);
    } catch {
      applyThemeToDom('dark');
    }
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeToDom(mode);
    try {
      window.localStorage.setItem('argon_lms_theme', mode);
    } catch {
      // Ignore storage restrictions
    }
  };

  const toggleTheme = () => {
    const nextMode: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextMode);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
        <div data-theme={theme} className={`${theme} argon-shell-bg min-h-screen`}>
          {children}
        </div>
      </ThemeContext.Provider>
    </QueryClientProvider>
  );
}
