import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AsideHeading {
  id: string;
  level: number;
  text: string;
}

export interface AsideData {
  title: string;
  updatedAt: string | null;
  headings: AsideHeading[];
  activeHeadingId: string | null;
  meta: {
    chars: number;
    charsWithSpace: number;
    paragraphs: number;
    online: number;
  };
  onJump: (id: string) => void;
}

interface AsideContextValue {
  opened: boolean;
  data: AsideData | null;
  publish: (data: AsideData | null) => void;
  toggle: () => void;
}

const AsideContext = createContext<AsideContextValue | null>(null);

export function AsideProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [data, setData] = useState<AsideData | null>(null);

  const publish = useCallback((next: AsideData | null) => setData(next), []);
  const toggle = useCallback(() => setOpened((value) => !value), []);

  const value = useMemo<AsideContextValue>(
    () => ({ opened, data, publish, toggle }),
    [opened, data, publish, toggle],
  );

  return <AsideContext.Provider value={value}>{children}</AsideContext.Provider>;
}

export function useAside() {
  const context = useContext(AsideContext);
  if (!context) throw new Error('useAside 必须在 AsideProvider 内使用');
  return context;
}

export function isDocPagePath(pathname: string) {
  return /^\/w\/[^/]+\/p\/[^/]+\/?$/.test(pathname);
}
