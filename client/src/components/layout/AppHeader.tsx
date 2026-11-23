import { useLocation, useNavigate } from 'react-router-dom';
import { ActionIcon, Menu, Tooltip, useComputedColorScheme } from '@mantine/core';
import {
  IconChevronDown,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconLogout,
  IconMoon,
  IconSearch,
  IconSettings,
  IconSun,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { useColorScheme } from '../../context/ColorSchemeContext';
import { useOpenCommandPalette } from '../../context/CommandPaletteContext';
import { isDocPagePath, useAside } from './AsideContext';
import classes from './AppHeader.module.css';

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

export default function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const openCommandPalette = useOpenCommandPalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { opened: asideOpened, toggle: toggleAside } = useAside();
  const isDocRoute = isDocPagePath(location.pathname);
  const { user, logout } = useAuth();
  const { mode, setMode } = useColorScheme();
  const computedColorScheme = useComputedColorScheme();

  const cycleColorScheme = () => {
    const next = mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
    setMode(next);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      // 上下文中的登出失败不改变当前页面
    }
  };

  return (
    <div className={classes.header}>
      <div className={classes.left}>
        <Tooltip label="显示 / 隐藏侧边栏" withArrow>
          <ActionIcon variant="subtle" size="sm" aria-label="切换侧边栏" onClick={onToggleSidebar}>
            <IconLayoutSidebar size={18} stroke={1.7} />
          </ActionIcon>
        </Tooltip>
        <a className={classes.brand} href="/home" onClick={(event) => {
          event.preventDefault();
          navigate('/home');
        }}>
          ZCollab
        </a>
      </div>

      <div className={classes.center}>
        <button type="button" className={classes.searchButton} onClick={openCommandPalette}>
          <IconSearch size={16} stroke={1.7} />
          <span className={classes.searchText}>搜索文档</span>
        </button>
      </div>

      <div className={classes.right}>
        {isDocRoute && (
          <Tooltip label={asideOpened ? '收起右侧栏' : '展开右侧栏'} withArrow>
            <ActionIcon
              variant={asideOpened ? 'filled' : 'subtle'}
              size="sm"
              aria-label="切换右侧栏"
              aria-pressed={asideOpened}
              onClick={toggleAside}
            >
              <IconLayoutSidebarRight size={18} stroke={1.7} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={`主题：${mode === 'auto' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'}（点击切换）`} withArrow>
          <ActionIcon variant="subtle" size="sm" aria-label="切换主题" onClick={cycleColorScheme}>
            {computedColorScheme === 'dark' ? <IconSun size={18} stroke={1.7} /> : <IconMoon size={18} stroke={1.7} />}
          </ActionIcon>
        </Tooltip>
        <Menu position="bottom-end" width={180} shadow="md">
          <Menu.Target>
            <button type="button" className={classes.userButton} aria-label="用户菜单">
              <span className={classes.userName}>{user?.name || user?.username || '用户'}</span>
              <IconChevronDown size={14} stroke={1.7} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{user?.name || user?.username}</Menu.Label>
            <Menu.Item leftSection={<IconSettings size={16} stroke={1.7} />} onClick={() => navigate('/settings')}>
              账户设置
            </Menu.Item>
            <Menu.Item leftSection={<IconLogout size={16} stroke={1.7} />} onClick={() => void handleLogout()}>
              登出
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
}
