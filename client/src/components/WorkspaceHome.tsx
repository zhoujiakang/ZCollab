import { useState } from 'react';
import { Badge, Button, Center, Container, Group, Loader, Paper, Select, Stack, Text, Title } from '@mantine/core';
import type { MeUser } from '../api/auth';
import type { Member, WorkspaceInfo, WorkspaceSummary } from '../api/workspace';
import { pageStyle } from './pageStyle';

interface WorkspaceHomeProps {
  user: MeUser;
  activeWorkspace: WorkspaceSummary;
  info: WorkspaceInfo | null;
  members: Member[];
  loading: boolean;
  onSwitch: (id: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onNewWorkspace: () => void;
}

function roleLabel(role: string) {
  return role === 'owner' ? '创建者' : role === 'member' ? '成员' : role;
}

export default function WorkspaceHome({
  user,
  activeWorkspace,
  info,
  members,
  loading,
  onSwitch,
  onLogout,
  onNewWorkspace,
}: WorkspaceHomeProps) {
  const [busy, setBusy] = useState(false);

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

  return (
    <Center mih="100vh" p="md" style={pageStyle}>
      <Container size="md" p={0}>
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
                <Button variant="subtle" size="compact-sm" color="teal" loading={busy} onClick={handleLogout}>
                  登出
                </Button>
              </Group>
            </Group>
          </Paper>

          <Paper shadow="sm" p="lg" radius="lg" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>成员</Title>
              <Text size="sm" c="dimmed">{info ? `${info.memberCount} 人` : ''}</Text>
            </Group>
            {loading ? (
              <Center py="xl"><Loader color="teal" size="sm" /></Center>
            ) : (
              <Stack gap="xs">
                {members.map((member) => (
                  <Group key={member.id} justify="space-between">
                    <Stack gap={0}>
                      <Text fw={500}>{member.name}</Text>
                      <Text size="xs" c="dimmed">@{member.username}</Text>
                    </Stack>
                    <Badge color={member.role === 'owner' ? 'teal' : 'gray'} variant="light">
                      {roleLabel(member.role)}
                    </Badge>
                  </Group>
                ))}
              </Stack>
            )}
          </Paper>

          <Button variant="light" color="teal" onClick={onNewWorkspace}>
            新建工作区
          </Button>
        </Stack>
      </Container>
    </Center>
  );
}
