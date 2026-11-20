import { useEffect, useState } from 'react';
import { Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { fetchMe, login, logout, register, type MeUser, type RegisteredUser } from './api/auth';
import { createWorkspace, switchWorkspace } from './api/workspace';
import LoginCard from './components/LoginCard';
import WorkspaceHome from './components/WorkspaceHome';
import WorkspaceWizard from './components/WorkspaceWizard';

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

export default function App() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

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

  const refreshMe = async () => {
    const me = await fetchMe();
    setUser(me);
    return me;
  };

  const handleLogin = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      const me = await refreshMe();
      setShowWizard(me.workspaces.items.length === 0);
      notifications.show({ color: 'green', title: '登录成功', message: '欢迎回来' });
    } catch (error) {
      notifyError(error);
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
      notifyError(error);
      return null;
    }
  };

  const handleCreateWorkspace = async (name: string) => {
    try {
      await createWorkspace(name);
      await refreshMe();
      setShowWizard(false);
      notifications.show({ color: 'green', title: '创建成功', message: '已进入新工作区' });
    } catch (error) {
      notifyError(error);
    }
  };

  const handleSwitch = async (id: string) => {
    try {
      await switchWorkspace(id);
      await refreshMe();
    } catch (error) {
      notifyError(error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setShowWizard(false);
      notifications.show({ color: 'blue', title: '已登出', message: '' });
    } catch (error) {
      notifyError(error);
    }
  };

  if (checking) {
    return (
      <Center h="100vh">
        <Loader color="teal" />
      </Center>
    );
  }

  if (!user) {
    return <LoginCard onLogin={handleLogin} onRegister={handleRegister} />;
  }

  const activeWorkspace = user.activeWorkspace;
  if (showWizard || user.workspaces.items.length === 0 || !activeWorkspace) {
    return <WorkspaceWizard onCreate={handleCreateWorkspace} onLogout={handleLogout} />;
  }

  return (
    <WorkspaceHome
      user={user}
      activeWorkspace={activeWorkspace}
      onSwitch={handleSwitch}
      onLogout={handleLogout}
      onNewWorkspace={() => setShowWizard(true)}
    />
  );
}
