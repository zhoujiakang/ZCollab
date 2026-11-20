import { useState } from 'react';
import { Button, Center, Container, Group, Paper, Select, Stack, Text, Title } from '@mantine/core';
import type { MeUser } from '../api/auth';
import type { WorkspaceSummary } from '../api/workspace';
import DocsPanel from './DocsPanel';
import { pageStyle } from './pageStyle';

interface WorkspaceHomeProps {
  user: MeUser;
  activeWorkspace: WorkspaceSummary;
  onSwitch: (id: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onNewWorkspace: () => void;
}

export default function WorkspaceHome({
  user,
  activeWorkspace,
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

          <DocsPanel workspaceId={activeWorkspace.id} user={user} />
        </Stack>
      </Container>
    </Center>
  );
}
