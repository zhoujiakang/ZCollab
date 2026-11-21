import { useState } from 'react';
import { Box, Button, Container, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import AuthLayout from './auth/AuthLayout';
import classes from './auth/auth.module.css';

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
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} size="h2" ta="center" fw={500} mb="md">
            创建工作区
          </Title>
          <Text c="dimmed" size="sm" ta="center" mb="lg">
            给你的协作空间起个名字
          </Text>
          <form onSubmit={form.onSubmit(handleCreate)}>
            <TextInput
              label="工作区名称"
              placeholder="例如：产品团队"
              variant="filled"
              {...form.getInputProps('name')}
            />
            <Button type="submit" fullWidth mt="xl" loading={busy}>
              创建工作区
            </Button>
          </form>
          <Text ta="center" size="sm" c="dimmed" mt="lg">
            <Button variant="subtle" size="compact-sm" px={6} loading={busy} onClick={onLogout}>
              登出
            </Button>
          </Text>
        </Box>
      </Container>
    </AuthLayout>
  );
}
