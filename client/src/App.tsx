import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import AppLayout from './components/layout/AppLayout';
import CommandPaletteHost from './components/layout/CommandPaletteHost';
import SharePage from './components/SharePage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceBridgeProvider, WorkspaceProvider } from './context/WorkspaceContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import SettingsPage from './pages/SettingsPage';
import WorkspaceOverviewPage from './pages/WorkspaceOverviewPage';
import PageView from './components/page/PageView';

function FullLoader() {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullLoader />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
  }
  const noWorkspace = user.workspaces.items.length === 0;
  if (noWorkspace && (location.pathname.startsWith('/home') || location.pathname.startsWith('/w/'))) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!user) return <LoginPage />;
  return <Navigate
    to={user.activeWorkspace ? `/w/${user.activeWorkspace.id}` : user.workspaces.items.length ? '/home' : '/onboarding'}
    replace
  />;
}

function ShareRoute() {
  const { token } = useParams();
  if (!token) return <Navigate to="/home" replace />;
  return <SharePage token={token} />;
}

function WorkspaceRoute() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { user, switchWorkspace } = useAuth();
  const [checkedId, setCheckedId] = useState<string | null>(null);
  const id = workspaceId!;
  const activeId = user?.activeWorkspace?.id;

  useEffect(() => {
    if (activeId === id) {
      setCheckedId(id);
      return;
    }
    if (checkedId === id) return;
    setCheckedId(id);
    let active = true;
    void switchWorkspace(id)
      .then((me) => {
        if (!active) return;
        if (me.activeWorkspace?.id !== id) {
          notifyError(new Error('无法进入该工作区'));
          navigate('/home', { replace: true });
        }
      })
      .catch((error) => {
        if (!active) return;
        notifyError(error);
        navigate('/home', { replace: true });
      });
    return () => {
      active = false;
    };
  }, [id, activeId, checkedId, switchWorkspace, navigate]);

  if (activeId !== id || checkedId !== id) return <FullLoader />;

  return (
    <WorkspaceProvider workspaceId={id}>
      <Outlet />
    </WorkspaceProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/s/:token" element={<ShareRoute />} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>
      <Route element={<RequireAuth><WorkspaceRoute /></RequireAuth>}>
        <Route path="/w/:workspaceId" element={<AppLayout />}>
          <Route index element={<WorkspaceOverviewPage />} />
          <Route path="p/:docId" element={<PageView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceBridgeProvider>
          <CommandPaletteHost>
            <AppRoutes />
          </CommandPaletteHost>
        </WorkspaceBridgeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
