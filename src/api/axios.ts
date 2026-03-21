import axios from 'axios';

type StoredTokenPayload =
  | string
  | {
      access_token?: string;
      token?: string;
      jwt?: string;
      value?: string;
    };

function normalizeBaseUrl(raw?: string) {
  const fallback =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000';

  const value = String(raw || fallback).replace(/\/+$/, '');
  return value.endsWith('/api') ? value : `${value}/api`;
}

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem('rt_token');
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredTokenPayload;

      if (typeof parsed === 'string') {
        const cleaned = parsed.replace(/^"+|"+$/g, '').trim();
        return cleaned || null;
      }

      if (parsed && typeof parsed === 'object') {
        const candidate =
          parsed.access_token ||
          parsed.token ||
          parsed.jwt ||
          parsed.value ||
          null;

        if (candidate && typeof candidate === 'string') {
          const cleaned = candidate.replace(/^"+|"+$/g, '').trim();
          return cleaned || null;
        }
      }
    } catch {
      // si no era JSON válido, seguimos con el valor crudo
    }

    const cleaned = raw.replace(/^"+|"+$/g, '').trim();
    return cleaned || null;
  } catch {
    return null;
  }
}

function getStoredUser<T = unknown>(): T | null {
  try {
    const raw = localStorage.getItem('rt_user');
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function persistStoredToken(token: unknown) {
  try {
    if (!token) return;

    if (typeof token === 'string') {
      localStorage.setItem('rt_token', token);
      return;
    }

    localStorage.setItem('rt_token', JSON.stringify(token));
  } catch {
    try {
      localStorage.setItem('rt_token', String(token));
    } catch {
      // noop
    }
  }
}

function persistStoredUser(user: unknown) {
  try {
    if (!user) return;
    localStorage.setItem('rt_user', JSON.stringify(user));
  } catch {
    // noop
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem('rt_user');
    localStorage.removeItem('rt_token');
  } catch {
    // noop
  }
}

function getNormalizedUserRole(user: any): string {
  return String(user?.role || '').trim().toLowerCase();
}

export function resolvePostLoginRoute(user: any): string {
  const role = getNormalizedUserRole(user);

  const preferredEventId =
    user?.defaultEventId ||
    user?.assignedEventId ||
    user?.defaultRaffleId ||
    user?.raffleId ||
    user?.eventId ||
    null;

  if (preferredEventId) {
    if (
      role === 'door' ||
      role === 'door_staff' ||
      role === 'access' ||
      role === 'access_staff'
    ) {
      return `/dashboard/${preferredEventId}/door`;
    }

    if (
      role === 'seller' ||
      role === 'rrpp' ||
      role === 'promoter'
    ) {
      return `/seller-dashboard/${preferredEventId}`;
    }

    if (
      role === 'creator' ||
      role === 'organizer' ||
      role === 'admin'
    ) {
      return `/dashboard/${preferredEventId}`;
    }
  }

  return '/';
}

export function getLoginSuccessMessage(user: any): string {
  const role = getNormalizedUserRole(user);

  if (
    role === 'door' ||
    role === 'door_staff' ||
    role === 'access' ||
    role === 'access_staff'
  ) {
    return 'Listo, ya podés entrar al control de acceso.';
  }

  if (
    role === 'seller' ||
    role === 'rrpp' ||
    role === 'promoter'
  ) {
    return 'Listo, ya podés compartir tu link y seguir tu panel.';
  }

  return 'Listo, ya podés administrar tus eventos.';
}

const api = axios.create({
  baseURL: normalizeBaseUrl(import.meta.env.VITE_API_URL),
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();

    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => {
    const tokenFromResponse =
      response?.data?.access_token ||
      response?.data?.token ||
      response?.data?.jwt ||
      null;

    const userFromResponse =
      response?.data?.user ||
      null;

    if (tokenFromResponse) {
      persistStoredToken(tokenFromResponse);
    }

    if (userFromResponse) {
      persistStoredUser(userFromResponse);
    }

    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      console.warn(
        'API 401: token inválido, vencido o request protegido sin sesión',
      );
      clearStoredAuth();
    }

    return Promise.reject(error);
  },
);

export {
  api,
  getStoredToken,
  getStoredUser,
  persistStoredToken,
  persistStoredUser,
  clearStoredAuth,
};
export default api;