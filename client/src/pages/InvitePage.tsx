import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Center, Container, Loader, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { getPublicInvite, type PublicInvite } from '../api/invite';
import { acceptInvite } from '../api/workspace';
import { useAuth } from '../context/AuthContext';
import classes from './InvitePage.module.css';

export default function InvitePage({ token }: { token: string }) {
  const navigate = useNavigate();
  const { user, loading: authLoading, switchWorkspace } = useAuth();
  const [invite, setInvite] = useState<PublicInvite | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setInvite(null);
    setFailed(false);
    getPublicInvite(token)
      .then((result) => {
        if (active) setInvite(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const isMember = Boolean(invite && user?.workspaces.items.some((workspace) =>
    String(workspace.id) === String(acceptedId) || workspace.name === invite.workspaceName));

  const handleJoin = async () => {
    if (!invite || busy) return;
    setBusy(true);
    try {
      const workspace = await acceptInvite(token);
      setAcceptedId(workspace.id);
      await switchWorkspace(workspace.id);
      navigate(`/w/${workspace.id}`, { replace: true });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '加入失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    } finally {
      setBusy(false);
    }
  };

  const expiresAt = invite?.expiresAt ? new Date(invite.expiresAt) : null;
  const expiryText = expiresAt
    ? `${expiresAt.getMonth() + 1} 月 ${expiresAt.getDate()} 日前有效`
    : '长期有效';

  return (
    <div className={classes.page}>
      <Container className={classes.inner} p={0}>
        <div className={classes.card}>
          {failed ? (
            <Center py={80}>
              <Text c="dimmed">链接已失效或已过期</Text>
            </Center>
          ) : !invite || authLoading ? (
            <Center py={80}>
              <Loader />
            </Center>
          ) : (
            <Stack gap="xl" align="center">
              <Stack gap="xs" align="center">
                <Text size="xl" fw={700} ta="center">
                  {invite.inviterName || '有人'} 邀请你加入 {invite.workspaceName}
                </Text>
                <Text size="sm" c="dimmed">已有 {invite.memberCount} 位成员</Text>
                <Text size="sm" c="dimmed">{expiryText}</Text>
              </Stack>
              <Button
                size="md"
                loading={busy}
                onClick={() => {
                  if (!user) {
                    navigate('/login', { state: { from: `/invite/${token}` } });
                    return;
                  }
                  void handleJoin();
                }}
              >
                {!user ? '登录后加入' : isMember ? '进入工作区' : '加入工作区'}
              </Button>
            </Stack>
          )}
        </div>
      </Container>
    </div>
  );
}
