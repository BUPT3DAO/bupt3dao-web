'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/icon';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'bupt3dao.theme';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, updateTheme] = useState<Theme>('system');
  const preference = useRef<Theme>('system');
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    try {
      const saved = localStorage.getItem(KEY);
      if (isTheme(saved)) preference.current = saved;
    } catch {
      /* Storage can be unavailable in private contexts. */
    }
    updateTheme(preference.current);
    const apply = () => {
      document.documentElement.dataset.theme =
        preference.current === 'system' ? (media.matches ? 'dark' : 'light') : preference.current;
    };
    const sync = (event: StorageEvent) => {
      if (event.key !== KEY && event.key !== null) return;
      preference.current = isTheme(event.newValue) ? event.newValue : 'system';
      updateTheme(preference.current);
      apply();
    };
    apply();
    media.addEventListener('change', apply);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', apply);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function setTheme(value: Theme) {
    preference.current = value;
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* Manual switching still works without persistence. */
    }
    document.documentElement.dataset.theme =
      value === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : value;
    updateTheme(value);
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeSwitch() {
  const context = useContext(ThemeContext);
  if (!context) return null;
  return (
    <label className="theme-switch">
      <Icon
        name={context.theme === 'dark' ? 'moon' : context.theme === 'light' ? 'sun' : 'monitor'}
        size={17}
      />
      <span className="visually-hidden">外观模式</span>
      <select value={context.theme} onChange={(e) => context.setTheme(e.target.value as Theme)}>
        <option value="system">跟随系统</option>
        <option value="light">亮色模式</option>
        <option value="dark">暗色模式</option>
      </select>
    </label>
  );
}
