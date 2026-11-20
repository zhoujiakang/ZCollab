import { useState } from 'react';
import { Button, Center, Container, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { pageStyle } from './pageStyle';

interface WorkspaceWizardProps {
  onCreate: (name: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function WorkspaceWizard({ onCreate, onLogout }: WorkspaceWizardProps) {
  const [busy, setBusy] = useState(false);
  const form = useForm({
    initialValues: { name: '' },
    validate: {
      name: (value) => (value.trim() ? null : '请输入工作区名称'),
    },
  });

  const handleCreate = async (values: { name: string }) => {
    setBusy(true);
    try {
      await onCreate(values.name.trim());
      form.reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Center mih="100vh" p="md" style={pageStyle}>
      <Container size="xs" p={0}>
        <Paper shadow="lg" p="xl" radius="lg" withBorder>
          <Stack gap="lg">
            <Stack gap={2} ta="center">
              <Title order={2} c="teal.8">创建工作区</Title>
              <Text c="dimmed" size="sm">给你的协作空间起个名字</Text>
            </Stack>
            <form onSubmit={form.onSubmit(handleCreate)}>
              <Stack gap="md">
                <TextInput label="工作区名称" placeholder="例如：产品团队" {...form.getInputProps('name')} />
                <Button type="submit" color="teal" fullWidth loading={busy}>
                  创建工作区
                </Button>
              </Stack>
            </form>
            <Text ta="center" size="sm">
              <Button variant="subtle" size="compact-sm" color="teal" loading={busy} onClick={onLogout}>
                登出
              </Button>
            </Text>
          </Stack>
        </Paper>
      </Container>
    </Center>
  );
}
