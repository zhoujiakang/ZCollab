import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { COLOR_SCHEME_STORAGE_KEY, readStoredColorScheme, type StoredColorScheme } from '../theme';

interface ColorSchemeContextValue {
  mode: StoredColorScheme;
  setMode: (mode: StoredColorScheme) => void;
}

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useMantineColorScheme();
  const [mode, setModeState] = useState<StoredColorScheme>(() => readStoredColorScheme());

  const setMode = useCallback((next: StoredColorScheme) => {
    setModeState(next);
    setColorScheme(next);
    try {
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, next);
    } catch {
      // 忽略存储不可用的情况
    }
  }, [setColorScheme]);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  if (!context) throw new Error('useColorScheme 必须在 ColorSchemeProvider 内使用');
  return context;
}
