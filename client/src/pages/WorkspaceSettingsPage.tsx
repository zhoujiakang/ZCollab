import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBuilding, IconUsers } from '@tabler/icons-react';
import { ApiError } from '../api/client';
import {
  createInvite,
  fetchInvites,
  fetchMembers,
  fetchWorkspaceInfo,
  inviteMember,
  removeMember,
  renameWorkspace,
  revokeInvite,
  transferOwner,
  type Invite,
  type Member,
  type WorkspaceInfo,
} from '../api/workspace';
import SettingsShell from '../components/settings/SettingsShell';
import { useAuth } from '../context/AuthContext';

type Section = 'general' | 'members';

type ConfirmAction =
  | { kind: 'leave' }
  | { kind: 'remove'; member: Member }
  | { kind: 'transfer'; member: Member };

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function isSelf(id: string, userId: string) {
  return String(id) === String(userId);
}

function inviteExpiryText(invite: Invite): string {
  if (!invite.expiresAt) return '长期有效';
  const days = Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000);
  return `${days} 天后过期`;
}

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshMe } = useAuth();
  const [section, setSection] = useState<Section>(location.hash === '#members' ? 'members' : 'general');
  const [info, setInfo] = useState<WorkspaceInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [inviteDays, setInviteDays] = useState('7');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);

  const isOwner = info?.role === 'owner';

  useEffect(() => {
    if (user && user.activeWorkspace?.id !== workspaceId) {
      navigate('/home', { replace: true });
    }
  }, [user, workspaceId, navigate]);

  const reloadInfo = useCallback(async () => {
    const next = await fetchWorkspaceInfo();
    setInfo(next);
    setName(next.name);
    return next;
  }, []);

  const reloadMembers = useCallback(async () => {
    const page = await fetchMembers({ pageSize: 100 });
    setMembers(page.items);
    setTotal(page.total);
  }, []);

  const reloadInvites = useCallback(async () => {
    setInvites(await fetchInvites());
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [infoResult, membersResult, invitesResult] = await Promise.allSettled([
      reloadInfo(), reloadMembers(), reloadInvites(),
    ]);
    if (infoResult.status === 'rejected' && membersResult.status === 'rejected') {
      setLoadError(true);
      notifyError(infoResult.reason);
    } else {
      setLoadError(false);
      if (infoResult.status === 'rejected') notifyError(infoResult.reason);
      if (membersResult.status === 'rejected') notifyError(membersResult.reason);
      if (invitesResult.status === 'rejected') notifyError(invitesResult.reason);
    }
    setLoading(false);
  }, [reloadInfo, reloadMembers, reloadInvites]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleCreateInvite = async () => {
    setInviteBusy(true);
    try {
      await createInvite(Number(inviteDays));
      await reloadInvites();
      notifications.show({ color: 'green', title: '已生成', message: '邀请链接已生成，可以复制分享' });
    } catch (error) {
      notifyError(error);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    setInviteBusy(true);
    try {
      await revokeInvite(id);
      await reloadInvites();
      notifications.show({ color: 'green', title: '已吊销', message: '该邀请链接已失效' });
    } catch (error) {
      notifyError(error);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async (invite: Invite) => {
    const url = `${window.location.origin}${invite.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyFallback(null);
      notifications.show({ color: 'green', title: '已复制', message: url });
    } catch {
      setCopyFallback(invite.id);
    }
  };

  const handleRename = async () => {
    const nextName = name.trim();
    if (!info || !nextName || nextName === info.name.trim() || renameBusy) return;
    setRenameBusy(true);
    try {
      await renameWorkspace(nextName);
      await reloadInfo();
      await refreshMe();
      notifications.show({ color: 'green', title: '已保存', message: '工作区名称已更新' });
    } catch (error) {
      notifyError(error);
    } finally {
      setRenameBusy(false);
    }
  };

  const handleAdd = async () => {
    const username = addUsername.trim();
    if (!username || addBusy) return;
    setAddBusy(true);
    try {
      await inviteMember(username);
      setAddUsername('');
      await reloadMembers();
      await reloadInfo();
      notifications.show({ color: 'green', title: '添加成功', message: `${username} 已加入工作区` });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notifications.show({ color: 'red', title: '添加失败', message: '没有找到该账号，对方需要先注册' });
      } else {
        notifyError(error);
      }
    } finally {
      setAddBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm || !user || actionBusy) return;
    setActionBusy(true);
    try {
      if (confirm.kind === 'leave') {
        await removeMember(String(user.id));
        await refreshMe(null);
        navigate('/home');
        notifications.show({ color: 'green', title: '已退出', message: '你已退出该工作区' });
      } else if (confirm.kind === 'remove') {
        await removeMember(confirm.member.id);
        await reloadMembers();
        await reloadInfo();
        notifications.show({
          color: 'green',
          title: '已移除',
          message: `${confirm.member.name || confirm.member.username} 已移出工作区`,
        });
      } else {
        await transferOwner(confirm.member.id);
        await reloadMembers();
        await reloadInfo();
        await refreshMe();
        notifications.show({
          color: 'green',
          title: '已转让',
          message: `${confirm.member.name || confirm.member.username} 现在是所有者`,
        });
      }
      setConfirm(null);
    } catch (error) {
      notifyError(error);
    } finally {
      setActionBusy(false);
    }
  };

  const renderMemberActions = (member: Member) => {
    const self = isSelf(member.id, user?.id ?? '');
    if (isOwner && !self) {
      return (
        <Group gap="xs" wrap="nowrap">
          <Button
            size="compact-xs"
            variant="subtle"
            color="red"
            loading={actionBusy}
            onClick={() => setConfirm({ kind: 'remove', member })}
          >
            移除
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            loading={actionBusy}
            onClick={() => setConfirm({ kind: 'transfer', member })}
          >
            转让所有权
          </Button>
        </Group>
      );
    }
    if (!isOwner && self) {
      return (
        <Button
          size="compact-xs"
          variant="subtle"
          color="red"
          loading={actionBusy}
          onClick={() => setConfirm({ kind: 'leave' })}
        >
          退出
        </Button>
      );
    }
    return null;
  };

  const confirmTitle = confirm?.kind === 'remove'
    ? '移除成员'
    : confirm?.kind === 'transfer'
      ? '转让所有权'
      : '退出工作区';
  const confirmMessage = confirm?.kind === 'remove'
    ? `确定要将 ${confirm.member.name || confirm.member.username} 移出工作区吗？`
    : confirm?.kind === 'transfer'
      ? `确定要把所有权转让给 ${confirm.member.name || confirm.member.username} 吗？转让后你会变成普通成员。`
      : '确定要退出当前工作区吗？退出后你将无法访问该工作区。';
  const confirmLabel = confirm?.kind === 'remove' ? '移除' : confirm?.kind === 'transfer' ? '转让' : '退出';

  return (
    <SettingsShell
      title="工作区设置"
      backTo="/home"
      items={[
        { key: 'general', label: '常规', icon: <IconBuilding size={18} stroke={1.7} /> },
        {
          key: 'members',
          label: (
            <Group gap={6} wrap="nowrap">
              <span>成员</span>
              <Badge size="xs" variant="light">{total || members.length}</Badge>
            </Group>
          ),
          icon: <IconUsers size={18} stroke={1.7} />,
        },
      ]}
      active={section}
      onSelect={(key) => setSection(key as Section)}
    >
      {loadError ? (
        <Card withBorder radius="md" padding="lg">
          <Stack gap="md" align="center">
            <Text c="red">加载工作区信息失败</Text>
            <Button onClick={() => void loadAll()}>重试</Button>
          </Stack>
        </Card>
      ) : loading ? (
        <Center h={200}><Loader /></Center>
      ) : section === 'general' ? (
        <Stack gap="lg">
          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Title order={5}>工作区名称</Title>
              <Divider />
              <TextInput
                label="名称"
                value={name}
                maxLength={100}
                disabled={renameBusy}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button
                  loading={renameBusy}
                  disabled={!name.trim() || !info || name.trim() === info.name.trim()}
                  onClick={() => void handleRename()}
                >
                  保存
                </Button>
              </Group>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Title order={5}>危险区</Title>
              <Divider />
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text fw={500}>退出工作区</Text>
                  <Text size="xs" c="dimmed">退出后你将不再属于该工作区</Text>
                </Stack>
                <Tooltip label="所有者不能退出，请先把所有权转让给其他成员" withArrow>
                  <span>
                    <Button
                      variant="light"
                      color="red"
                      disabled={isOwner}
                      onClick={() => setConfirm({ kind: 'leave' })}
                    >
                      退出工作区
                    </Button>
                  </span>
                </Tooltip>
              </Group>
            </Stack>
          </Card>
        </Stack>
      ) : (
        <Stack gap="lg">
          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Title order={5}>邀请链接</Title>
              <Divider />
              <Group gap="xs" wrap="nowrap">
                <SegmentedControl
                  size="xs"
                  value={inviteDays}
                  onChange={setInviteDays}
                  data={[
                    { value: '7', label: '7 天' },
                    { value: '30', label: '30 天' },
                    { value: '0', label: '永不过期' },
                  ]}
                />
                <Button size="compact-sm" loading={inviteBusy} onClick={() => void handleCreateInvite()}>
                  生成链接
                </Button>
              </Group>
              {invites.length === 0 ? (
                <Text size="sm" c="dimmed">暂无有效邀请链接</Text>
              ) : invites.map((invite) => (
                <Stack
                  key={invite.id}
                  gap={6}
                  style={{ padding: '6px 0', borderBottom: '1px solid var(--mantine-color-default-border)' }}
                >
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="sm">{invite.creatorName || '成员'} 创建 · {inviteExpiryText(invite)}</Text>
                    <Group gap="xs" wrap="nowrap">
                      <Button size="compact-xs" variant="subtle" onClick={() => void handleCopyInvite(invite)}>
                        复制
                      </Button>
                      {(isOwner || isSelf(invite.createdBy, user?.id ?? '')) && (
                        <Button
                          size="compact-xs"
                          variant="subtle"
                          color="red"
                          loading={inviteBusy}
                          onClick={() => void handleRevokeInvite(invite.id)}
                        >
                          吊销
                        </Button>
                      )}
                    </Group>
                  </Group>
                  {copyFallback === invite.id && (
                    <TextInput
                      aria-label="邀请链接"
                      readOnly
                      value={`${window.location.origin}${invite.path}`}
                      onClick={(event) => event.currentTarget.select()}
                    />
                  )}
                </Stack>
              ))}
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Title order={5}>添加成员</Title>
              <Divider />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAdd();
                }}
              >
                <Group gap="xs" wrap="nowrap">
                  <TextInput
                    style={{ flex: 1 }}
                    aria-label="成员账号"
                    placeholder="输入账号"
                    value={addUsername}
                    disabled={addBusy}
                    onChange={(event) => setAddUsername(event.currentTarget.value)}
                  />
                  <Button type="submit" loading={addBusy}>添加</Button>
                </Group>
              </form>
            </Stack>
          </Card>

          <Card withBorder radius="md" padding="lg">
            <Stack gap="md">
              <Title order={5}>成员</Title>
              <Divider />
              {members.map((member) => (
                <Group
                  key={member.id}
                  justify="space-between"
                  gap="sm"
                  wrap="nowrap"
                  style={{ padding: '6px 0', borderBottom: '1px solid var(--mantine-color-default-border)' }}
                >
                  <Group gap="sm" wrap="nowrap">
                    <Avatar name={member.name || member.username} size="sm" radius="xl" />
                    <Stack gap={0}>
                      <Text size="sm" fw={500}>{member.name || member.username}</Text>
                      <Text size="xs" c="dimmed">@{member.username}</Text>
                    </Stack>
                    <Badge size="sm" variant="light" color={member.role === 'owner' ? 'blue' : 'gray'}>
                      {member.role === 'owner' ? '所有者' : '成员'}
                    </Badge>
                  </Group>
                  {renderMemberActions(member)}
                </Group>
              ))}
              {total > members.length && (
                <Text size="xs" c="dimmed">共 {total} 人，仅显示前 100 位</Text>
              )}
            </Stack>
          </Card>
        </Stack>
      )}

      <Modal
        opened={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirmTitle}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">{confirmMessage}</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirm(null)} disabled={actionBusy}>取消</Button>
            <Button
              color={confirm?.kind === 'transfer' ? 'blue' : 'red'}
              loading={actionBusy}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </SettingsShell>
  );
}
