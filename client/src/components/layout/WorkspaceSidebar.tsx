import { useRef, useState, type ReactNode, type Ref } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ActionIcon, Menu, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconChevronsDown,
  IconClock,
  IconFileImport,
  IconHome,
  IconPlus,
  IconSearch,
  IconSelector,
  IconStar,
  IconStarOff,
} from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';
import { useOpenCommandPalette } from '../../context/CommandPaletteContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { importDoc } from '../../api/doc';
import { markdownToDoc } from '../../lib/markdownImport';
import { DOC_TEMPLATES, type DocTemplate } from '../../lib/docTemplates';
import PageTree from '../page/PageTree';
import classes from './Sidebar.module.css';

interface MenuEntryProps {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  ref?: Ref<HTMLButtonElement>;
}

function MenuEntry({ label, icon, active, disabled, onClick, ref }: MenuEntryProps) {
  return (
    <UnstyledButton
      ref={ref}
      className={`${classes.menu} ${active ? classes.menuActive : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={classes.menuIcon}>{icon}</span>
      <span className={classes.menuLabel}>{label}</span>
    </UnstyledButton>
  );
}

interface QuickListGroupProps {
  title: string;
  items: { id: string; title: string }[];
  icon: ReactNode;
  currentDocId?: string;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
}

function QuickListGroup({ title, items, icon, currentDocId, onSelect, onRemove }: QuickListGroupProps) {
  return (
    <div className={`${classes.section} ${classes.quickSection}`}>
      <div className={classes.quickHeader}>
        <Text size="xs" fw={500} c="dimmed">{title}</Text>
      </div>
      <div className={classes.quickList}>
        {items.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={item.title || '无标题'}
            aria-current={item.id === currentDocId ? 'page' : undefined}
            className={`${classes.quickRow} ${item.id === currentDocId ? classes.quickRowActive : ''}`}
            onClick={() => onSelect(item.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item.id);
              }
            }}
          >
            <span className={classes.quickIcon}>{icon}</span>
            <span className={classes.quickTitle}>{item.title || '无标题'}</span>
            {onRemove && (
              <Tooltip label="取消收藏" withArrow>
                <ActionIcon
                  size="compact-xs"
                  variant="subtle"
                  aria-label={`取消收藏 ${item.title || '无标题'}`}
                  className={classes.quickRemove}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(item.id);
                  }}
                >
                  <IconStarOff size={13} stroke={1.7} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorkspaceSidebar() {
  const openCommandPalette = useOpenCommandPalette();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    workspaceId, docs, loadingDocs, favorites, recent, create, createFromTemplate,
    remove, reloadDocs, flushPendingSave, toggleFavorite,
  } = useWorkspace();
  const [collapseAllSignal, setCollapseAllSignal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [createMenuOpened, setCreateMenuOpened] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleCreateFromTemplate = async (template: DocTemplate) => {
    if (busy) return;
    setBusy(true);
    try {
      const doc = await createFromTemplate(template, currentDocId ?? null);
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

  const handleImportFile = async (file: File) => {
    if (busy) return;
    if (file.size > 2 * 1024 * 1024) {
      notifications.show({ color: 'red', title: '导入失败', message: '文件过大' });
      return;
    }
    setBusy(true);
    try {
      await flushPendingSave();
      const md = await file.text();
      const { json, text } = markdownToDoc(md);
      const title = file.name.replace(/\.(md|markdown)$/i, '') || '未命名文档';
      const doc = await importDoc({
        title,
        parentId: null,
        content: JSON.stringify(json),
        contentText: text,
      });
      await reloadDocs();
      navigate(`/w/${workspaceId}/p/${doc.id}`);
      notifications.show({ color: 'green', title: '导入成功', message: `已创建「${doc.title}」` });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '导入失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setBusy(false);
    }
  };

  const openQuickDoc = (docId: string) => {
    if (docId === currentDocId) return;
    void flushPendingSave().then(() => navigate(`/w/${workspaceId}/p/${docId}`));
  };

  const handleRemoveFavorite = (id: string) => {
    void toggleFavorite(id).catch(() => undefined);
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        aria-label="导入 Markdown 文件"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleImportFile(file);
        }}
      />
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
          <Menu
            opened={createMenuOpened}
            onChange={setCreateMenuOpened}
            position="bottom-start"
            width={280}
            shadow="md"
          >
            <Menu.Target>
              <MenuEntry
                label="新建页面"
                icon={<IconPlus size={18} stroke={1.7} />}
                disabled={busy}
              />
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={() => {
                  setCreateMenuOpened(false);
                  void handleCreate(currentDocId ?? null);
                }}
              >
                空白页面
              </Menu.Item>
              <Menu.Divider />
              {DOC_TEMPLATES.map((template) => (
                <Menu.Item
                  key={template.id}
                  onClick={() => {
                    setCreateMenuOpened(false);
                    void handleCreateFromTemplate(template);
                  }}
                >
                  <div>{template.name}</div>
                  <Text className={classes.menuDescription}>{template.description}</Text>
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <MenuEntry
            label="导入 Markdown"
            icon={<IconFileImport size={18} stroke={1.7} />}
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          />
        </div>
      </div>

      {favorites.length > 0 && (
        <QuickListGroup
          title="收藏"
          items={favorites}
          icon={<IconStar size={14} stroke={1.7} />}
          currentDocId={currentDocId}
          onSelect={openQuickDoc}
          onRemove={handleRemoveFavorite}
        />
      )}

      {recent.length > 0 && (
        <QuickListGroup
          title="最近"
          items={recent.slice(0, 10)}
          icon={<IconClock size={14} stroke={1.7} />}
          currentDocId={currentDocId}
          onSelect={openQuickDoc}
        />
      )}

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
            <Tooltip label="导入 Markdown" withArrow>
              <ActionIcon
                variant="default"
                size={18}
                aria-label="导入 Markdown"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <IconFileImport size={13} stroke={1.7} />
              </ActionIcon>
            </Tooltip>
          </div>
        </div>
        <div className={classes.pages}>
          {!loadingDocs && docs.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              还没有页面 · 按侧栏「新建页面」开始
            </Text>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
