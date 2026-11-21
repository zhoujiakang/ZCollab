import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import type { RegisteredUser } from '../api/auth';
import LoginCard from '../components/LoginCard';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      const me = await login(values.username, values.password);
      notifications.show({ color: 'green', title: '登录成功', message: '欢迎回来' });
      if (me.workspaces.items.length === 0) {
        navigate('/onboarding', { replace: true });
      } else if (from && from.startsWith('/')) {
        navigate(from, { replace: true });
      } else {
        navigate(me.activeWorkspace ? `/w/${me.activeWorkspace.id}` : '/home', { replace: true });
      }
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const handleRegister = async (values: {
    username: string;
    password: string;
    name: string;
  }): Promise<RegisteredUser | null> => {
    try {
      const created = await register(values.username, values.password, values.name);
      notifications.show({ color: 'green', title: '注册成功', message: '请用刚注册的账号登录' });
      return created;
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
      return null;
    }
  };

  return <LoginCard onLogin={handleLogin} onRegister={handleRegister} />;
}
