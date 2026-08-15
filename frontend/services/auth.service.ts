import { api } from '@/lib/api';
import type {
  ApiResponse,
  AuthUser,
  HealthStatus,
  LoginRequest,
  LoginResponse,
  LoginResult,
  RegisterRequest,
  RegisterResponse,
  RegisteredUser,
} from '@/types/auth';

// Login público: retorna token + usuario. El backend registra la sesión en la tabla Sesion.
export async function login(payload: LoginRequest): Promise<LoginResult> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', payload);
  if (!data.data) {
    throw new Error(data.message || 'Respuesta de login inválida');
  }
  return data.data;
}

export async function refreshSession(refreshToken: string): Promise<LoginResult> {
  const { data } = await api.post<LoginResponse>('/api/auth/refresh', { refreshToken });
  if (!data.data) {
    throw new Error(data.message || 'Respuesta de refresh inválida');
  }
  return data.data;
}

export async function getCurrentAuthUser(): Promise<AuthUser> {
  const { data } = await api.get<ApiResponse<AuthUser>>('/api/auth/me');
  if (!data.data) {
    throw new Error(data.message || 'Respuesta de usuario actual inválida');
  }
  return data.data;
}

export async function logout(refreshToken?: string): Promise<void> {
  await api.post('/api/auth/logout', { refreshToken });
}

// Registro: libre en bootstrap (sin usuarios); luego requiere token (lo adjunta el interceptor).
export async function register(payload: RegisterRequest): Promise<RegisteredUser> {
  const { data } = await api.post<RegisterResponse>('/api/auth/register', payload);
  if (!data.data) {
    throw new Error(data.message || 'Respuesta de registro inválida');
  }
  return data.data;
}

// Healthcheck del backend.
export async function health(): Promise<HealthStatus> {
  const { data } = await api.get<HealthStatus>('/health');
  return data;
}
