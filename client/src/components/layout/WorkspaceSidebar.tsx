import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionIcon, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChevronsDown,
  IconHome,
  IconPlus,
  IconSearch,
  IconSelector,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { useOpenCommandPalette } from '../../context/CommandPaletteContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import PageTree from '../page/PageTree';
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

export default function WorkspaceSidebar() {
  const openCommandPalette = useOpenCommandPalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { workspaceId, docs, loadingDocs, create, remove, flushPendingSave } = useWorkspace();
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const [busy, setBusy] = useState(false);

  const currentDocId = /^\/w\/[^/]+\/p\/([^/]+)/.exec(location.pathname)?.[1];
  const isOverview = location.pathname === `/w/${workspaceId}`;
  const workspaces = user?.workspaces.items ?? [];

  const handleCreate = async (parentDocId?: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      const doc = await create(parentDocId ?? null);
      navigate(`/w/${workspaceId}/p/${doc.id}`);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`确定删除「${title || '无标题'}」及其所有子文档吗？`)) return;
    try {
      await remove(id);
      if (id === currentDocId) navigate(`/w/${workspaceId}`);
      notifications.show({ color: 'green', title: '已删除', message: '' });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  return (
    <div className={classes.navbar}>
      <div className={classes.section}>
        <Menu position="bottom-start" width={260} shadow="md">
          <Menu.Target>
            <button type="button" className={classes.switcher} aria-label="切换工作区">
              <span className={classes.switcherName}>
                {user?.activeWorkspace?.name || '工作区'}
              </span>
              <IconSelector size={16} stroke={1.7} />
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>切换工作区</Menu.Label>
            {workspaces.map((workspace) => (
              <Menu.Item
                key={workspace.id}
                className={workspace.id === workspaceId ? classes.menuActive : undefined}
                onClick={() => {
                  if (workspace.id !== workspaceId) navigate(`/w/${workspace.id}`);
                }}
              >
                {workspace.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>

      <div className={classes.section}>
        <div className={classes.menuItems}>
          <MenuEntry
            label="概览"
            icon={<IconHome size={18} stroke={1.7} />}
            active={isOverview}
            onClick={() => navigate(`/w/${workspaceId}`)}
          />
          <MenuEntry
            label="搜索"
            icon={<IconSearch size={18} stroke={1.7} />}
            onClick={openCommandPalette}
          />
          <MenuEntry
            label="新建页面"
            icon={<IconPlus size={18} stroke={1.7} />}
            onClick={() => void handleCreate(currentDocId ?? null)}
          />
        </div>
      </div>

      <div className={`${classes.section} ${classes.pagesSection}`}>
        <div className={classes.pagesHeader}>
          <Text size="xs" fw={500} c="dimmed">页面</Text>
          <div className={classes.pagesHeaderActions}>
            <Tooltip label="全部折叠" withArrow>
              <ActionIcon
                variant="default"
                size={18}
                aria-label="全部折叠"
                onClick={() => setCollapseAllSignal((signal) => signal + 1)}
              >
                <IconChevronsDown size={13} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="新建页面" withArrow>
              <ActionIcon
                variant="default"
                size={18}
                aria-label="新建页面"
                loading={busy}
                onClick={() => void handleCreate()}
              >
                <IconPlus size={13} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
        <div className={classes.pages}>
          <PageTree
            docs={docs}
            currentDocId={currentDocId}
            loading={loadingDocs}
            collapseAllSignal={collapseAllSignal}
            onSelect={(docId) => {
              if (docId === currentDocId) return;
              void flushPendingSave().then(() => navigate(`/w/${workspaceId}/p/${docId}`));
            }}
            onDelete={(id, title) => void handleDelete(id, title)}
          />
        </div>
      </div>
    </div>
  );
}
