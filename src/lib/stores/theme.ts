// Theme store with persistence
// Light theme is default, dark theme uses .dark class
import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type Theme = 'dark' | 'light';

function createThemeStore() {
  // Get initial theme from localStorage or system preference
  const getInitialTheme = (): Theme => {
    if (!browser) return 'light';

    const stored = localStorage.getItem('cdv-theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }

    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  };

  const applyTheme = (theme: Theme) => {
    if (browser) {
      document.documentElement.classList.remove('light', 'dark');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  };

  const { subscribe, set, update } = writable<Theme>(getInitialTheme());

  return {
    subscribe,
    set: (theme: Theme) => {
      if (browser) {
        localStorage.setItem('cdv-theme', theme);
        applyTheme(theme);
      }
      set(theme);
    },
    toggle: () => {
      update(current => {
        const next = current === 'dark' ? 'light' : 'dark';
        if (browser) {
          localStorage.setItem('cdv-theme', next);
          applyTheme(next);
        }
        return next;
      });
    },
    init: () => {
      if (browser) {
        const theme = getInitialTheme();
        applyTheme(theme);
        set(theme);
      }
    }
  };
}

export const theme = createThemeStore();
