'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { UNAUTHORIZED_EVENT } from '@/lib/api';
import {
  getServerSnapshot,
  getSnapshot,
  persistLogin,
  persistUser,
  persistLogout,
  subscribe,
} from '@/lib/auth-store';
import { login as loginService } from '@/services/auth.service';
import { getCurrentAuthUser } from '@/services/auth.service';
import type { AuthUser, LoginRequest } from '@/types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const logout = useCallback(() => {
    persistLogout();
    router.replace('/login');
  }, [router]);

  // Reacciona a 401 global emitido por el interceptor de Axios.
  useEffect(() => {
    function handleUnauthorized() {
      persistLogout();
      router.replace('/login');
    }
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [router]);

  useEffect(() => {
    if (!snapshot.hydrated || !snapshot.user) {
      return;
    }

    let cancelled = false;

    async function syncCurrentUser() {
      try {
        if (!snapshot.user) {
          return;
        }

        const currentUser = await getCurrentAuthUser();
        if (!cancelled) {
          const currentSnapshotUser = snapshot.user;
          const isSameUser =
            currentSnapshotUser.id === currentUser.id &&
            JSON.stringify(currentSnapshotUser.permisos ?? {}) ===
              JSON.stringify(currentUser.permisos ?? {}) &&
            currentSnapshotUser.nombreRol === currentUser.nombreRol;

          if (!isSameUser) {
            persistUser(currentUser);
          }
        }
      } catch {
        if (!cancelled) {
          persistLogout();
          router.replace('/login');
        }
      }
    }

    void syncCurrentUser();

    function handleWindowFocus() {
      void syncCurrentUser();
    }

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [snapshot.hydrated, snapshot.user, router]);

  const login = useCallback(async (credentials: LoginRequest) => {
    const result = await loginService(credentials);
    persistLogin(result.accessToken, result.refreshToken, result.user);
    return result.user;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: snapshot.user,
      isAuthenticated: Boolean(snapshot.user),
      isLoading: !snapshot.hydrated,
      login,
      logout,
    }),
    [snapshot, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
