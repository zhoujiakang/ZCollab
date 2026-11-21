import { useState } from 'react';
import { Box, Button, Container, PasswordInput, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { RegisteredUser } from '../api/auth';
import AuthLayout from './auth/AuthLayout';
import classes from './auth/auth.module.css';

type Mode = 'login' | 'register';

interface LoginCardProps {
  onLogin: (values: { username: string; password: string }) => Promise<void>;
  onRegister: (values: { username: string; password: string; name: string }) => Promise<RegisteredUser | null>;
}

function validateUsername(value: string) {
  if (!value.trim()) return '请输入账号';
  if (value.length < 3 || value.length > 32) return '账号长度须为 3-32 位';
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return '账号只允许字母、数字、下划线和连字符';
  return null;
}

export default function LoginCard({ onLogin, onRegister }: LoginCardProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);

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

  const handleLogin = async (values: { username: string; password: string }) => {
    setBusy(true);
    try {
      await onLogin(values);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (values: { username: string; password: string; name: string }) => {
    setBusy(true);
    try {
      const created = await onRegister(values);
      if (created) {
        loginForm.setValues({ username: created.username, password: '' });
        registerForm.reset();
        setMode('login');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} size="h2" ta="center" fw={500} mb="md">
            {mode === 'login' ? '登录' : '注册'}
          </Title>

          {mode === 'login' ? (
            <form onSubmit={loginForm.onSubmit(handleLogin)}>
              <TextInput
                label="账号"
                placeholder="3-32 位字母、数字、_ 或 -"
                variant="filled"
                autoComplete="username"
                {...loginForm.getInputProps('username')}
              />
              <PasswordInput
                label="密码"
                placeholder="请输入密码"
                variant="filled"
                mt="md"
                autoComplete="current-password"
                visibilityToggleButtonProps={{ 'aria-label': '显示 / 隐藏密码' }}
                {...loginForm.getInputProps('password')}
              />
              <Button type="submit" fullWidth mt="md" loading={busy}>
                登录
              </Button>
            </form>
          ) : (
            <form onSubmit={registerForm.onSubmit(handleRegister)}>
              <TextInput
                label="账号"
                placeholder="3-32 位字母、数字、_ 或 -"
                variant="filled"
                autoComplete="username"
                {...registerForm.getInputProps('username')}
              />
              <TextInput
                label="昵称"
                placeholder="可留空，默认使用账号"
                variant="filled"
                mt="md"
                {...registerForm.getInputProps('name')}
              />
              <PasswordInput
                label="密码"
                placeholder="至少 8 位"
                variant="filled"
                mt="md"
                autoComplete="new-password"
                visibilityToggleButtonProps={{ 'aria-label': '显示 / 隐藏密码' }}
                {...registerForm.getInputProps('password')}
              />
              <Button type="submit" fullWidth mt="md" loading={busy}>
                注册
              </Button>
            </form>
          )}

          <Text ta="center" size="sm" c="dimmed" mt="lg">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <Button
              variant="subtle"
              size="compact-sm"
              px={6}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                loginForm.clearErrors();
                registerForm.clearErrors();
              }}
            >
              {mode === 'login' ? '去注册' : '去登录'}
            </Button>
          </Text>
        </Box>
      </Container>
    </AuthLayout>
  );
}
