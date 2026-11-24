import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  fetchMe,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type MeUser,
  type RegisteredUser,
} from '../api/auth';
import { createWorkspace as createWorkspaceRequest, switchWorkspace as switchWorkspaceRequest } from '../api/workspace';

interface AuthContextValue {
  user: MeUser | null;
  loading: boolean;
  refreshMe: (workspaceId?: string | null) => Promise<MeUser>;
  login: (username: string, password: string) => Promise<MeUser>;
  register: (username: string, password: string, name: string) => Promise<RegisteredUser>;
  logout: () => Promise<void>;
  createWorkspace: (name: string) => Promise<MeUser>;
  switchWorkspace: (id: string) => Promise<MeUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // 登录态先独立于路由确认；无权访问的工作区交给 WorkspaceRoute 处理。
    fetchMe({}, null)
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const refreshMe = useCallback(async (workspaceId?: string | null) => {
    const me = await fetchMe({}, workspaceId);
    setUser(me);
    return me;
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      await loginRequest(username, password);
      return refreshMe();
    },
    [refreshMe],
  );

  const register = useCallback((username: string, password: string, name: string) => {
    return registerRequest(username, password, name);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const createWorkspace = useCallback(
    async (name: string) => {
      const created = await createWorkspaceRequest(name);
      return refreshMe(created.id);
    },
    [refreshMe],
  );

  const switchWorkspace = useCallback(
    async (id: string) => {
      await switchWorkspaceRequest(id);
      return refreshMe(id);
    },
    [refreshMe],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, refreshMe, login, register, logout, createWorkspace, switchWorkspace }),
    [user, loading, refreshMe, login, register, logout, createWorkspace, switchWorkspace],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用');
  return context;
}
