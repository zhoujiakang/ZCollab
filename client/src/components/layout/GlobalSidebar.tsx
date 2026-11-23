import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UnstyledButton } from '@mantine/core';
import { IconApps, IconHome, IconSettings, IconUserPlus } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import classes from './Sidebar.module.css';

interface MenuEntryProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}

function MenuEntry({ label, icon, active, onClick }: MenuEntryProps) {
  return (
    <UnstyledButton className={`${classes.menu} ${active ? classes.menuActive : ''}`} onClick={onClick}>
      <span className={classes.menuIcon}>{icon}</span>
      <span className={classes.menuLabel}>{label}</span>
    </UnstyledButton>
  );
}

export default function GlobalSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isHome = location.pathname === '/home';
  const activeWorkspace = user?.activeWorkspace;
  const settingsWorkspaceId = activeWorkspace?.id ?? user?.workspaces.items[0]?.id;

  return (
    <div className={classes.navbar}>
      <div className={classes.section}>
        <div className={classes.menuItems}>
          <MenuEntry
            label="首页"
            icon={<IconHome size={18} stroke={1.7} />}
            active={isHome && !location.hash}
            onClick={() => navigate('/home')}
          />
          <MenuEntry
            label="工作区"
            icon={<IconApps size={18} stroke={1.7} />}
            active={isHome && location.hash === '#spaces'}
            onClick={() => navigate('/home#spaces')}
          />
        </div>
      </div>

      <div className={classes.spacer} />

      <div className={classes.bottomSection}>
        <div className={classes.menuItems}>
          <MenuEntry
            label="邀请成员"
            icon={<IconUserPlus size={18} stroke={1.7} />}
            onClick={() => navigate('/home#members')}
          />
          {settingsWorkspaceId && (
            <MenuEntry
              label="设置"
              icon={<IconSettings size={18} stroke={1.7} />}
              onClick={() => navigate(`/w/${settingsWorkspaceId}/settings`)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
