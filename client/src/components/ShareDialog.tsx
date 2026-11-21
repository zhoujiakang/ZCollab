import { useEffect, useState } from 'react';
import { Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  createShareLink,
  getShareStatus,
  revokeShareLink,
  type ShareCreateResult,
} from '../api/share';

interface ShareDialogProps {
  opened: boolean;
  onClose: () => void;
  docId: string;
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

export default function ShareDialog({ opened, onClose, docId }: ShareDialogProps) {
  const [share, setShare] = useState<ShareCreateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = share ? `${window.location.origin}${share.path}` : '';

  useEffect(() => {
    if (!opened) return;
    let active = true;
    setShare(null);
    setError(null);
    setLoading(true);
    getShareStatus(docId)
      .then((status) => {
        if (!active) return;
        if (status.shared && status.token) {
          setShare({ token: status.token, path: `/s/${status.token}` });
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : '读取分享状态失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [opened, docId]);

  const handleCreate = () => {
    setBusy(true);
    createShareLink(docId)
      .then((result) => {
        setShare(result);
        setError(null);
        notifications.show({ color: 'green', title: '只读链接已生成', message: '' });
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('当前浏览器不支持自动复制，请手动选择地址复制');
      }
      await navigator.clipboard.writeText(url);
      notifications.show({ color: 'green', title: '已复制', message: '' });
    } catch (cause) {
      notifyError(cause);
    }
  };

  const handleRevoke = () => {
    setBusy(true);
    revokeShareLink(docId)
      .then(() => {
        setShare(null);
        notifications.show({ color: 'green', title: '链接已撤销', message: '' });
      })
      .catch(notifyError)
      .finally(() => setBusy(false));
  };

  return (
    <Modal opened={opened} onClose={onClose} title="分享文档" centered size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          任何拿到链接的人都可以只读查看这篇文档，无需登录。
        </Text>
        {error && <Text size="sm" c="red">{error}</Text>}
        {loading ? (
          <Text size="sm" c="dimmed">正在读取分享状态…</Text>
        ) : share ? (
          <>
            <TextInput label="只读链接" value={url} readOnly aria-label="只读链接" />
            <Group justify="flex-end" gap="sm" wrap="nowrap">
              <Button variant="light" color="blue" onClick={handleCopy}>复制</Button>
              <Button variant="subtle" color="red" loading={busy} onClick={handleRevoke}>
                撤销链接
              </Button>
            </Group>
          </>
        ) : (
          <Group justify="flex-end">
            <Button color="blue" loading={busy} onClick={handleCreate}>生成只读链接</Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
