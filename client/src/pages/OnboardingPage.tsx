import { useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import WorkspaceWizard from '../components/WorkspaceWizard';
import { useAuth } from '../context/AuthContext';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { createWorkspace, logout } = useAuth();

  const handleCreate = async (name: string) => {
    try {
      const me = await createWorkspace(name);
      notifications.show({ color: 'green', title: '创建成功', message: '已进入新工作区' });
      if (me.activeWorkspace) navigate(`/w/${me.activeWorkspace.id}`, { replace: true });
      else navigate('/home', { replace: true });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  return <WorkspaceWizard onCreate={handleCreate} onLogout={handleLogout} />;
}
