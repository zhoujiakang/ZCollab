import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Group, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { fetchMembers, inviteMember, removeMember, type Member } from '../api/workspace';
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
  const { user, createWorkspace, refreshMe, logout } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [busy, setBusy] = useState(false);

  const activeWorkspace = user!.activeWorkspace;
  const isOwner = activeWorkspace?.role === 'owner';
  const isSelf = (id: string) => String(id) === String(user!.id);

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

  const handleInvite = async () => {
    const username = inviteName.trim();
    if (!username || inviting) return;
    setInviting(true);
    try {
      await inviteMember(username);
      setInviteName('');
      await refreshMembers();
      notifications.show({ color: 'green', title: '邀请成功', message: `${username} 已加入工作区` });
    } catch (error) {
      notifyError(error);
    } finally {
      setInviting(false);
    }
  };

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

  const handleRemove = async (member: Member) => {
    const self = isSelf(member.id);
    setBusy(true);
    try {
      await removeMember(String(member.id));
      if (self) {
        const me = await refreshMe();
        if (me.activeWorkspace) navigate(`/w/${me.activeWorkspace.id}`);
        else navigate('/onboarding');
      } else {
        await refreshMembers();
      }
      notifications.show({
        color: 'green',
        title: self ? '已退出' : '已移除',
        message: self ? '你已退出该工作区' : `${member.name || member.username} 已移除`,
      });
    } catch (error) {
      notifyError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      notifyError(error);
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
          <Text className={classes.muted}>{membersLoading ? '加载中…' : `${members.length} 人`}</Text>
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
                {(isOwner && !isSelf(member.id)) || (!isOwner && isSelf(member.id)) ? (
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    color="red"
                    loading={busy}
                    onClick={() => void handleRemove(member)}
                  >
                    {isSelf(member.id) ? '退出' : '移除'}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <form
            className={classes.inviteForm}
            onSubmit={(event) => {
              event.preventDefault();
              void handleInvite();
            }}
          >
            <Group gap="xs" wrap="nowrap">
              <TextInput
                className={classes.grow}
                aria-label="邀请账号"
                placeholder="输入账号，回车邀请"
                value={inviteName}
                onChange={(event) => setInviteName(event.currentTarget.value)}
                disabled={inviting}
              />
              <Button type="submit" loading={inviting}>邀请</Button>
            </Group>
          </form>
        </div>
      </section>

      <section id="settings" className={classes.section}>
        <div className={classes.sectionHead}>
          <Title order={4}>设置</Title>
        </div>
        <div className={classes.card}>
          <Text size="sm">当前工作区：{activeWorkspace?.name}</Text>
          <Text className={classes.muted}>你的角色：{activeWorkspace?.role === 'owner' ? '所有者' : '成员'}</Text>
          <Button mt="md" variant="subtle" onClick={() => void handleLogout()}>登出</Button>
        </div>
      </section>
    </div>
  );
}
