import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import AppHeader from './AppHeader';
import { AsideProvider, isDocPagePath, useAside } from './AsideContext';
import { CommentDraftProvider } from './CommentDraftContext';
import { CommentsProvider } from './CommentsContext';
import GlobalSidebar from './GlobalSidebar';
import WorkspaceSidebar from './WorkspaceSidebar';
import PageAside from '../page/PageAside';
import classes from './AppLayout.module.css';

export default function AppLayout() {
  return (
    <AsideProvider>
      <CommentDraftProvider>
        <CommentsProvider>
          <AppShellLayout />
        </CommentsProvider>
      </CommentDraftProvider>
    </AsideProvider>
  );
}

function AppShellLayout() {
  const location = useLocation();
  const { opened: asideOpened } = useAside();
  const isSmall = useMediaQuery('(max-width: 48em)');
  const [mobileOpened, setMobileOpened] = useState(false);
  const [desktopOpened, setDesktopOpened] = useState(true);
  const isWorkspaceRoute = /^\/w\/[^/]+/.test(location.pathname);
  const isDocRoute = isDocPagePath(location.pathname);

  const toggleSidebar = () => {
    if (isSmall) setMobileOpened((opened) => !opened);
    else setDesktopOpened((opened) => !opened);
  };

  return (
    <AppShell
      header={{ height: 45 }}
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      aside={isDocRoute ? {
        width: 350,
        breakpoint: 'sm',
        collapsed: { desktop: !asideOpened, mobile: true },
      } : undefined}
      padding={0}
      withBorder={false}
      classNames={{ header: classes.header, navbar: classes.navbar, aside: classes.aside, main: classes.main }}
    >
      <AppShell.Header>
        <AppHeader onToggleSidebar={toggleSidebar} />
      </AppShell.Header>
      <AppShell.Navbar>
        {isWorkspaceRoute ? <WorkspaceSidebar /> : <GlobalSidebar />}
      </AppShell.Navbar>
      {isDocRoute && (
        <AppShell.Aside>
          <PageAside />
        </AppShell.Aside>
      )}
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
