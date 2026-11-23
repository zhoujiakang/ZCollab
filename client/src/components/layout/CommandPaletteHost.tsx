import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CommandPaletteContext } from '../../context/CommandPaletteContext';
import { useWorkspaceBridge } from '../../context/WorkspaceContext';
import CommandPalette from './CommandPalette';
import ShortcutCheatsheet from './ShortcutCheatsheet';

export default function CommandPaletteHost({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const { workspace } = useWorkspaceBridge();
  const [opened, setOpened] = useState(false);
  const [cheatsheetOpened, setCheatsheetOpened] = useState(false);

  const open = useCallback(() => setOpened(true), []);
  const close = useCallback(() => setOpened(false), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        open();
      }
      if (event.key === '?') {
        const target = event.target;
        if (target instanceof HTMLElement) {
          const tagName = target.tagName;
          if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable) return;
        }
        event.preventDefault();
        setCheatsheetOpened(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const currentDocId = /^\/w\/[^/]+\/p\/([^/]+)/.exec(location.pathname)?.[1];

  return (
    <CommandPaletteContext.Provider value={open}>
      {children}
      <CommandPalette
        opened={opened}
        onClose={close}
        workspaceId={workspace?.workspaceId ?? user?.activeWorkspace?.id}
        docs={workspace?.docs}
        currentDocId={currentDocId}
        workspace={workspace}
      />
      <ShortcutCheatsheet
        opened={cheatsheetOpened}
        onClose={() => setCheatsheetOpened(false)}
      />
    </CommandPaletteContext.Provider>
  );
}
