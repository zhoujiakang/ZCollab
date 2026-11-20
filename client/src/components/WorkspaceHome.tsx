import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Group,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { MeUser } from '../api/auth';
import {
  fetchMembers,
  inviteMember,
  removeMember,
  type Member,
  type WorkspaceSummary,
} from '../api/workspace';
import DocsPanel from './DocsPanel';
import { pageStyle } from './pageStyle';

interface WorkspaceHomeProps {
  user: MeUser;
  activeWorkspace: WorkspaceSummary;
  onSwitch: (id: string) => Promise<void>;
  onRefreshUser: () => Promise<MeUser>;
  onLogout: () => Promise<void>;
  onNewWorkspace: () => void;
}

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

export default function WorkspaceHome({
  user,
  activeWorkspace,
  onSwitch,
  onRefreshUser,
  onLogout,
  onNewWorkspace,
}: WorkspaceHomeProps) {
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = activeWorkspace.role === 'owner';
  const isSelf = (id: string) => String(id) === String(user.id);

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
  }, [activeWorkspace.id, refreshMembers]);

  const handleSwitch = async (id: string) => {
    setBusy(true);
    try {
      await onSwitch(id);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await onLogout();
    } finally {
      setBusy(false);
    }
  };

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

  const nextWorkspaceId = () => {
    const workspaces = user.workspaces.items;
    const currentIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspace.id);
    const next = workspaces.find(
      (workspace, index) => index > currentIndex && workspace.id !== activeWorkspace.id,
    ) ?? workspaces.find((workspace) => workspace.id !== activeWorkspace.id);
    return next?.id ?? null;
  };

  const handleRemove = async (member: Member) => {
    if (removingId) return;
    const self = isSelf(member.id);
    const memberId = String(member.id);
    const nextId = self ? nextWorkspaceId() : null;
    setRemovingId(memberId);
    try {
      await removeMember(memberId);
      if (self) {
        await onRefreshUser();
        if (nextId) await onSwitch(nextId);
        else onNewWorkspace();
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
      setRemovingId(null);
    }
  };

  return (
    <Center mih="100vh" p="md" style={pageStyle}>
      <Container size="lg" p={0}>
        <Stack gap="lg">
          <Paper shadow="sm" p="md" radius="lg" withBorder>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="md" wrap="nowrap">
                <Title order={3} c="teal.8">{activeWorkspace.name}</Title>
                <Select
                  aria-label="切换工作区"
                  placeholder="切换工作区"
                  size="sm"
                  allowDeselect={false}
                  data={user.workspaces.items.map((workspace) => ({
                    value: workspace.id,
                    label: workspace.name,
                  }))}
                  value={activeWorkspace.id}
                  onChange={(value) => {
                    if (value && value !== activeWorkspace.id) void handleSwitch(value);
                  }}
                  disabled={busy}
                />
              </Group>
              <Group gap="sm" wrap="nowrap">
                <Text size="sm">{user.name}</Text>
                <Button variant="light" size="compact-sm" color="teal" onClick={onNewWorkspace}>
                  新建工作区
                </Button>
                <Button variant="subtle" size="compact-sm" color="teal" loading={busy} onClick={handleLogout}>
                  登出
                </Button>
              </Group>
            </Group>
          </Paper>

          <Paper shadow="sm" p="md" radius="lg" withBorder>
            <Group justify="space-between">
              <Text fw={600}>成员</Text>
              <Text size="sm" c="dimmed">{members.length} 人</Text>
            </Group>
            <Stack gap="xs" mt="sm">
              {membersLoading && members.length === 0 ? (
                <Text size="sm" c="dimmed">正在加载成员…</Text>
              ) : (
                members.map((member) => {
                  const self = isSelf(member.id);
                  const initial = (member.name || member.username || '?').trim().charAt(0).toUpperCase() || '?';
                  return (
                    <Group key={member.id} justify="space-between" gap="xs" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Box
                          w={32}
                          h={32}
                          flex="0 0 32px"
                          style={{
                            borderRadius: '50%',
                            background: 'var(--mantine-color-teal-1)',
                            color: 'var(--mantine-color-teal-8)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {initial}
                        </Box>
                        <Text size="sm" fw={500} truncate>{member.name || member.username}</Text>
                        <Badge
                          size="sm"
                          variant="light"
                          color={member.role === 'owner' ? 'teal' : 'gray'}
                        >
                          {member.role === 'owner' ? '所有者' : '成员'}
                        </Badge>
                      </Group>
                      {isOwner && !self ? (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          loading={removingId === String(member.id)}
                          onClick={() => void handleRemove(member)}
                        >
                          移除
                        </Button>
                      ) : !isOwner && self ? (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          loading={removingId === String(member.id)}
                          onClick={() => void handleRemove(member)}
                        >
                          退出
                        </Button>
                      ) : null}
                    </Group>
                  );
                })
              )}
            </Stack>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleInvite();
              }}
              style={{ marginTop: 12 }}
            >
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  style={{ flex: 1 }}
                  aria-label="邀请账号"
                  placeholder="输入账号，回车邀请"
                  value={inviteName}
                  onChange={(event) => setInviteName(event.currentTarget.value)}
                  disabled={inviting}
                />
                <Button type="submit" size="compact-sm" color="teal" loading={inviting}>
                  邀请
                </Button>
              </Group>
            </form>
          </Paper>

          <DocsPanel workspaceId={activeWorkspace.id} user={user} />
        </Stack>
      </Container>
    </Center>
  );
}
