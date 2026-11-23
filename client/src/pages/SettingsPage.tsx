import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  Divider,
  Group,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLogout, IconPalette, IconUser } from '@tabler/icons-react';
import SettingsShell from '../components/settings/SettingsShell';
import { uploadImage } from '../api/file';
import { changePassword, updateProfile } from '../api/user';
import { useAuth } from '../context/AuthContext';
import { useColorScheme } from '../context/ColorSchemeContext';

type Section = 'account' | 'appearance';

interface PasswordErrors {
  oldPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误';
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, refreshMe, logout } = useAuth();
  const { mode, setMode } = useColorScheme();
  const [section, setSection] = useState<Section>('account');
  const [name, setName] = useState(user?.name ?? '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [passwordBusy, setPasswordBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentName = user?.name ?? '';

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  if (!user) return null;

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarBusy(true);
    try {
      const uploaded = await uploadImage(file);
      await updateProfile({ name: user.name, avatarUrl: uploaded.url });
      await refreshMe();
      notifications.show({ color: 'green', title: '已保存', message: '头像已更换' });
    } catch (error) {
      notifications.show({ color: 'red', title: '更换头像失败', message: errorMessage(error) });
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleNameSave = async () => {
    const nextName = name.trim();
    if (!nextName || nextName === user.name.trim() || nameBusy) return;

    setNameBusy(true);
    try {
      await updateProfile({ name: nextName, avatarUrl: user.avatarUrl });
      await refreshMe();
      notifications.show({ color: 'green', title: '已保存', message: '昵称已更新' });
    } catch (error) {
      notifications.show({ color: 'red', title: '保存失败', message: errorMessage(error) });
    } finally {
      setNameBusy(false);
    }
  };

  const handlePasswordSubmit = async () => {
    const errors: PasswordErrors = {};
    if (newPassword.length < 8) errors.newPassword = '新密码不能少于 8 位';
    if (newPassword !== confirmPassword) errors.confirmPassword = '两次输入的新密码不一致';
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setPasswordErrors({});
    setPasswordBusy(true);
    try {
      await changePassword({ oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notifications.show({ color: 'green', title: '密码已修改', message: '其他设备已被登出' });
    } catch (error) {
      setPasswordErrors({ oldPassword: errorMessage(error) });
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      notifications.show({ color: 'red', title: '退出失败', message: errorMessage(error) });
    }
  };

  const handleModeChange = (value: string | null) => {
    if (value === 'auto' || value === 'light' || value === 'dark') setMode(value);
  };

  return (
    <SettingsShell
      title="设置"
      backTo="/home"
      items={[
        { key: 'account', label: '账户', icon: <IconUser size={18} stroke={1.7} /> },
        { key: 'appearance', label: '外观', icon: <IconPalette size={18} stroke={1.7} /> },
      ]}
      active={section}
      onSelect={(key) => setSection(key as Section)}
    >
      {section === 'account' ? (
            <Stack gap="lg">
              <Card withBorder radius="md" padding="lg">
                <Stack gap="md">
                  <Title order={5}>账户资料</Title>
                  <Divider />
                  <Group gap="lg" wrap="nowrap">
                    <Box style={{ position: 'relative', width: 96, height: 96, flex: '0 0 96px' }}>
                      <button
                        type="button"
                        aria-label="更换头像"
                        disabled={avatarBusy}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          position: 'relative',
                          width: 96,
                          height: 96,
                          padding: 0,
                          border: 0,
                          borderRadius: '50%',
                          overflow: 'hidden',
                          cursor: avatarBusy ? 'wait' : 'pointer',
                          background: 'transparent',
                        }}
                      >
                        <Avatar src={user.avatarUrl ?? undefined} name={user.name} size={96} radius={999} />
                        <Box
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(0, 0, 0, 0.5)',
                            color: '#fff',
                            fontSize: 12,
                          }}
                        >
                          {avatarBusy ? '上传中…' : '更换头像'}
                        </Box>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={avatarBusy}
                        onChange={(event) => void handleAvatarChange(event)}
                      />
                    </Box>
                    <Stack gap={4}>
                      <Text fw={500}>{user.name}</Text>
                      <Text size="sm" c="dimmed">点击头像可以更换</Text>
                    </Stack>
                  </Group>
                  <TextInput
                    label="昵称"
                    value={name}
                    maxLength={50}
                    disabled={nameBusy}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                  <Group justify="flex-end">
                    <Button
                      loading={nameBusy}
                      disabled={!name.trim() || name.trim() === user.name.trim()}
                      onClick={() => void handleNameSave()}
                    >
                      保存
                    </Button>
                  </Group>
                  <Divider />
                  <TextInput label="用户名" value={user.username} readOnly />
                  <Text size="xs" c="dimmed">用户名不可修改</Text>
                  <Divider />
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2}>
                      <Text fw={500}>退出登录</Text>
                      <Text size="xs" c="dimmed">退出当前设备的登录状态</Text>
                    </Stack>
                    <Button variant="light" color="red" onClick={() => void handleLogout()}>
                      退出登录
                    </Button>
                  </Group>
                </Stack>
              </Card>

              <Card withBorder radius="md" padding="lg">
                <form onSubmit={(event) => {
                  event.preventDefault();
                  void handlePasswordSubmit();
                }}>
                  <Stack gap="md">
                    <Title order={5}>修改密码</Title>
                    <Divider />
                    <PasswordInput
                      label="原密码"
                      value={oldPassword}
                      error={passwordErrors.oldPassword}
                      autoComplete="current-password"
                      onChange={(event) => setOldPassword(event.currentTarget.value)}
                    />
                    <PasswordInput
                      label="新密码"
                      value={newPassword}
                      error={passwordErrors.newPassword}
                      autoComplete="new-password"
                      onChange={(event) => setNewPassword(event.currentTarget.value)}
                    />
                    <PasswordInput
                      label="确认新密码"
                      value={confirmPassword}
                      error={passwordErrors.confirmPassword}
                      autoComplete="new-password"
                      onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                    />
                    <Group justify="flex-end">
                      <Button type="submit" loading={passwordBusy}>修改密码</Button>
                    </Group>
                  </Stack>
                </form>
              </Card>
            </Stack>
          ) : (
            <Card withBorder radius="md" padding="lg">
              <Stack gap="md">
                <Title order={5}>外观</Title>
                <Divider />
                <Text size="sm">选择与当前环境匹配的显示主题。</Text>
                <SegmentedControl
                  fullWidth
                  value={mode}
                  onChange={handleModeChange}
                  data={[
                    { value: 'auto', label: '跟随系统' },
                    { value: 'light', label: '浅色' },
                    { value: 'dark', label: '深色' },
                  ]}
                />
                <Text size="xs" c="dimmed">切换立即生效，无需保存。</Text>
              </Stack>
            </Card>
      )}
    </SettingsShell>
  );
}
