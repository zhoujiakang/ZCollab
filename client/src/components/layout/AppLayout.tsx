import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import AppHeader from './AppHeader';
import GlobalSidebar from './GlobalSidebar';
import WorkspaceSidebar from './WorkspaceSidebar';
import classes from './AppLayout.module.css';

export default function AppLayout() {
  const location = useLocation();
  const isSmall = useMediaQuery('(max-width: 48em)');
  const [mobileOpened, setMobileOpened] = useState(false);
  const [desktopOpened, setDesktopOpened] = useState(true);
  const isWorkspaceRoute = /^\/w\/[^/]+/.test(location.pathname);

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
      padding={0}
      withBorder={false}
      classNames={{ header: classes.header, navbar: classes.navbar, main: classes.main }}
    >
      <AppShell.Header>
        <AppHeader onToggleSidebar={toggleSidebar} />
      </AppShell.Header>
      <AppShell.Navbar>
        {isWorkspaceRoute ? <WorkspaceSidebar /> : <GlobalSidebar />}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
