// Store de autenticación basado en localStorage, consumible con useSyncExternalStore.
// Evita setState-en-efecto y previene mismatches de hidratación (snapshot de servidor estable).

import { clearAuth, getStoredUser, getToken, setStoredUser, setToken } from './auth-storage';
import type { AuthUser } from '@/types/auth';

export interface AuthSnapshot {
  user: AuthUser | null;
  // hydrated=false durante SSR y primer render; true una vez montado en cliente.
  hydrated: boolean;
}

const SERVER_SNAPSHOT: AuthSnapshot = { user: null, hydrated: false };

let listeners: Array<() => void> = [];
let cachedSnapshot: AuthSnapshot | null = null;

function computeSnapshot(): AuthSnapshot {
  const token = getToken();
  const user = getStoredUser<AuthUser>();
  return { user: token && user ? user : null, hydrated: true };
}

function emit(): void {
  cachedSnapshot = computeSnapshot();
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// getSnapshot debe devolver una referencia estable entre renders (se cachea).
export function getSnapshot(): AuthSnapshot {
  if (!cachedSnapshot) {
    cachedSnapshot = computeSnapshot();
  }
  return cachedSnapshot;
}

export function getServerSnapshot(): AuthSnapshot {
  return SERVER_SNAPSHOT;
}

export function persistLogin(token: string, user: AuthUser): void {
  setToken(token);
  setStoredUser(user);
  emit();
}

export function persistLogout(): void {
  clearAuth();
  emit();
}
