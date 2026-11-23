import type { ReactNode } from 'react';
import { Box, Stack, Text } from '@mantine/core';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Stack align="center" justify="center" gap="xs" py="xl" ta="center">
      <Box style={{ display: 'inline-flex', opacity: 0.5 }}>{icon}</Box>
      <Text fw={600}>{title}</Text>
      {description && <Text size="sm" c="dimmed">{description}</Text>}
      {action && <Box mt="xs">{action}</Box>}
    </Stack>
  );
}
