import { useState } from 'react';
import { Alert, Button, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { apiGet } from './api/client';

export default function App() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkHealth = async () => {
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const result = await apiGet<{ status: string }>('/health');
      setStatus(`后端状态：${result.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '检查失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="sm" py={80}>
      <Paper shadow="xs" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <Title order={2}>ZCollab</Title>
          <Button onClick={checkHealth} loading={loading}>
            检查后端状态
          </Button>
          {status && <Text fw={600}>{status}</Text>}
          {error && (
            <Alert color="red" title="检查失败">
              {error}
            </Alert>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}
