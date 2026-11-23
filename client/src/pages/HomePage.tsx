import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Group, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { fetchMembers, type Member } from '../api/workspace';
import { useAuth } from '../context/AuthContext';
import classes from './pages.module.css';

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

async function fetchAllMembers(): Promise<Member[]> {
  const pageSize = 100;
  const first = await fetchMembers({ page: 1, pageSize });
  const totalPages = Math.ceil(first.total / pageSize);
  if (totalPages <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      fetchMembers({ page: index + 2, pageSize }),
    ),
  );
  return [...first.items, ...rest.flatMap((page) => page.items)];
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, createWorkspace } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);

  const activeWorkspace = user!.activeWorkspace;

  const refreshMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      setMembers(await fetchAllMembers());
    } catch (error) {
      notifyError(error);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMembers();
  }, [activeWorkspace?.id, refreshMembers]);

  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const me = await createWorkspace(name);
      setNewWorkspaceName('');
      notifications.show({ color: 'green', title: '创建成功', message: '已进入新工作区' });
      if (me.activeWorkspace) navigate(`/w/${me.activeWorkspace.id}`);
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={classes.content}>
      <Title order={2}>首页</Title>
      <Text className={classes.muted}>欢迎回来，{user!.name || user!.username}</Text>

      <section id="spaces" className={classes.section}>
        <div className={classes.sectionHead}>
          <Title order={4}>工作区</Title>
          <Text className={classes.muted}>{user!.workspaces.items.length} 个工作区</Text>
        </div>
        <div className={classes.workspaceGrid}>
          {user!.workspaces.items.map((workspace) => (
            <button
              type="button"
              key={workspace.id}
              className={`${classes.workspaceCard} ${workspace.id === activeWorkspace?.id ? classes.workspaceCardActive : ''}`}
              onClick={() => navigate(`/w/${workspace.id}`)}
            >
              <Text fw={600}>{workspace.name}</Text>
              <Text className={classes.muted}>
                {workspace.id === activeWorkspace?.id ? '当前工作区' : workspace.role === 'owner' ? '所有者' : '成员'}
              </Text>
            </button>
          ))}
        </div>
        <div className={`${classes.card} ${classes.section}`}>
          <Text fw={600} mb="xs">新建工作区</Text>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              className={classes.grow}
              aria-label="新工作区名称"
              placeholder="工作区名称"
              value={newWorkspaceName}
              onChange={(event) => setNewWorkspaceName(event.currentTarget.value)}
              disabled={busy}
            />
            <Button loading={busy} onClick={() => void handleCreateWorkspace()}>创建</Button>
          </Group>
        </div>
      </section>

      <section id="members" className={classes.section}>
        <div className={classes.sectionHead}>
          <Title order={4}>成员</Title>
          <Group gap="sm" wrap="nowrap">
            <Text className={classes.muted}>{membersLoading ? '加载中…' : `${members.length} 人`}</Text>
            <Button
              size="compact-sm"
              variant="light"
              onClick={() => navigate(activeWorkspace ? `/w/${activeWorkspace.id}/settings` : '/home#spaces')}
            >
              管理工作区
            </Button>
          </Group>
        </div>
        <div className={classes.card}>
          <div className={classes.stack}>
            {members.map((member) => (
              <div key={member.id} className={classes.memberRow}>
                <Group gap="sm" wrap="nowrap">
                  <span className={classes.avatar}>
                    {(member.name || member.username || '?').trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <Text size="sm" fw={500}>{member.name || member.username}</Text>
                  <Badge size="sm" variant="light" color={member.role === 'owner' ? 'blue' : 'gray'}>
                    {member.role === 'owner' ? '所有者' : '成员'}
                  </Badge>
                </Group>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
