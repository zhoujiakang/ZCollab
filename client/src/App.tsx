import { useEffect, useState } from 'react';
import {
  Button,
  Center,
  Container,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { fetchMe, login, logout, register, type MeUser } from './api/auth';

type Mode = 'login' | 'register';

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function validateUsername(value: string) {
  if (!value.trim()) return '请输入账号';
  if (value.length < 3 || value.length > 32) return '账号长度须为 3-32 位';
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return '账号只允许字母、数字、下划线和连字符';
  return null;
}

export default function App() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>('login');

  const loginForm = useForm({
    initialValues: { username: '', password: '' },
    validate: {
      username: validateUsername,
      password: (value) => (value ? null : '请输入密码'),
    },
  });

  const registerForm = useForm({
    initialValues: { username: '', password: '', name: '' },
    validate: {
      username: validateUsername,
      password: (value) => (value.length >= 8 ? null : '密码长度不能少于 8 位'),
      name: (value) => (value.length <= 255 ? null : '昵称长度不能超过 255'),
    },
  });

  useEffect(() => {
    let active = true;
    fetchMe()
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    try {
      await login(values.username, values.password);
      setUser(await fetchMe());
      notifications.show({ color: 'green', title: '登录成功', message: '欢迎回来' });
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (values: { username: string; password: string; name: string }) => {
    setSubmitting(true);
    try {
      const created = await register(values.username, values.password, values.name);
      notifications.show({ color: 'green', title: '注册成功', message: '请用刚注册的账号登录' });
      loginForm.setValues({ username: created.username, password: '' });
      registerForm.reset();
      setMode('login');
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    try {
      await logout();
      setUser(null);
      notifications.show({ color: 'blue', title: '已登出', message: '' });
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <Center h="100vh">
        <Loader color="teal" />
      </Center>
    );
  }

  return (
    <Center
      mih="100vh"
      p="md"
      style={{ background: 'linear-gradient(135deg, #e3fbf6 0%, #eef2ff 55%, #fdf2f8 100%)' }}
    >
      <Container size="xs" p={0}>
        <Paper shadow="lg" p="xl" radius="lg" withBorder>
          {user ? (
            <Stack gap="lg" align="center" ta="center">
              <Title order={2}>ZCollab</Title>
              <Text fz={28} fw={700} c="teal.7">你好，{user.name}</Text>
              <Text c="dimmed">账号：{user.username}</Text>
              <Button color="teal" fullWidth loading={submitting} onClick={handleLogout}>
                登出
              </Button>
            </Stack>
          ) : (
            <Stack gap="lg">
              <Stack gap={2} ta="center">
                <Title order={2} c="teal.8">ZCollab</Title>
                <Text c="dimmed" size="sm">
                  {mode === 'login' ? '登录后开始协作' : '创建你的账号'}
                </Text>
              </Stack>

              {mode === 'login' ? (
                <form onSubmit={loginForm.onSubmit(handleLogin)}>
                  <Stack gap="md">
                    <TextInput
                      label="账号"
                      placeholder="3-32 位字母、数字、_ 或 -"
                      autoComplete="username"
                      {...loginForm.getInputProps('username')}
                    />
                    <PasswordInput
                      label="密码"
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      {...loginForm.getInputProps('password')}
                    />
                    <Button type="submit" color="teal" fullWidth loading={submitting}>
                      登录
                    </Button>
                  </Stack>
                </form>
              ) : (
                <form onSubmit={registerForm.onSubmit(handleRegister)}>
                  <Stack gap="md">
                    <TextInput
                      label="账号"
                      placeholder="3-32 位字母、数字、_ 或 -"
                      autoComplete="username"
                      {...registerForm.getInputProps('username')}
                    />
                    <TextInput
                      label="昵称"
                      placeholder="可留空，默认使用账号"
                      {...registerForm.getInputProps('name')}
                    />
                    <PasswordInput
                      label="密码"
                      placeholder="至少 8 位"
                      autoComplete="new-password"
                      {...registerForm.getInputProps('password')}
                    />
                    <Button type="submit" color="teal" fullWidth loading={submitting}>
                      注册
                    </Button>
                  </Stack>
                </form>
              )}

              <Text ta="center" size="sm" c="dimmed">
                {mode === 'login' ? '还没有账号？' : '已有账号？'}
                <Button
                  variant="subtle"
                  size="compact-sm"
                  px={6}
                  color="teal"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    loginForm.clearErrors();
                    registerForm.clearErrors();
                  }}
                >
                  {mode === 'login' ? '去注册' : '去登录'}
                </Button>
              </Text>
            </Stack>
          )}
        </Paper>
      </Container>
    </Center>
  );
}
