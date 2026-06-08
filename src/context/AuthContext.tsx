import {
  createContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  clearStoredAuth,
  getStoredToken,
  persistStoredToken,
} from '../services/api';

export type AuthRole = 'master' | 'creator' | 'organizer' | 'guest' | 'seller' | 'door';

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email: string;
  role: AuthRole;

  assignedEventId?: string | null;
  defaultEventId?: string | null;
  raffleId?: string | null;
  eventId?: string | null;

  rawRole?: string;
};

type AuthContextType = {
  user: AuthUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  token: string | null;
  login: (userData: unknown, token: unknown) => void;
  logout: () => void;
  updateUser: (userData: unknown) => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  ready: false,
  isAuthenticated: false,
  token: null,
  login: () => undefined,
  logout: () => undefined,
  updateUser: () => undefined,
});

function normalizeRole(rawRole: unknown): AuthRole {
  const role = String(rawRole || '')
    .trim()
    .toLowerCase();

  if (
    role === 'master' ||
    role === 'superadmin'
  ) {
    return 'master';
  }

  if (
    role === 'seller' ||
    role === 'rrpp' ||
    role === 'promoter' ||
    role === 'promotor' ||
    role === 'reseller'
  ) {
    return 'seller';
  }

  if (role === 'organizer') {
    return 'organizer';
  }

  if (
    role === 'guest' ||
    role === 'final' ||
    role === 'user'
  ) {
    return 'guest';
  }

  if (
    role === 'door' ||
    role === 'door_staff' ||
    role === 'access' ||
    role === 'access_staff' ||
    role === 'gatekeeper' ||
    role === 'checker'
  ) {
    return 'door';
  }

  return 'creator';
}

function getBestId(raw: any): string | null {
  const candidate =
    raw?.id ??
    raw?.userId ??
    raw?.sub ??
    raw?._id ??
    raw?.adminId ??
    raw?.sellerId ??
    raw?.staffId ??
    null;

  if (candidate === null || candidate === undefined || candidate === '') {
    return null;
  }

  return String(candidate);
}

function getFirstName(raw: any): string {
  const candidate =
    raw?.firstName ||
    raw?.firstname ||
    raw?.name?.split(' ')?.[0] ||
    raw?.fullName?.split(' ')?.[0] ||
    raw?.username?.split('@')?.[0] ||
    raw?.email?.split('@')?.[0] ||
    'Usuario';

  return String(candidate || 'Usuario').trim();
}

function getLastName(raw: any): string {
  const direct = raw?.lastName || raw?.lastname;
  if (direct) return String(direct).trim();

  const source = String(raw?.fullName || raw?.name || '').trim();
  if (!source) return '';

  const parts = source.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ').trim() : '';
}

function getFullName(raw: any, firstName: string, lastName: string): string {
  const candidate =
    raw?.fullName ||
    raw?.fullname ||
    raw?.name ||
    `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();

  return String(candidate || '').trim();
}

function getEmail(raw: any): string {
  const candidate = raw?.email || raw?.username || raw?.mail || '';
  return String(candidate || '').trim();
}

function getOptionalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim() || null;
}

function normalizeStoredUser(raw: any): AuthUser | null {
  if (!raw || typeof raw !== 'object') return null;

  const id = getBestId(raw);
  if (!id) return null;

  const firstName = getFirstName(raw);
  const lastName = getLastName(raw);
  const fullName = getFullName(raw, firstName, lastName);
  const email = getEmail(raw);
  const role = normalizeRole(raw?.role);

  return {
    id,
    firstName,
    lastName,
    fullName,
    email,
    role,
    rawRole: getOptionalString(raw?.role) || undefined,

    assignedEventId: getOptionalString(
      raw?.assignedEventId ?? raw?.assigned_event_id ?? raw?.event_id,
    ),
    defaultEventId: getOptionalString(
      raw?.defaultEventId ?? raw?.default_event_id,
    ),
    raffleId: getOptionalString(raw?.raffleId ?? raw?.raffle_id),
    eventId: getOptionalString(raw?.eventId ?? raw?.event_id),
  };
}

function normalizeToken(token: unknown): string | null {
  if (!token) return null;

  if (typeof token === 'string') {
    const cleaned = token.replace(/^"+|"+$/g, '').trim();
    return cleaned || null;
  }

  if (typeof token === 'object') {
    const candidate =
      (token as any).access_token ||
      (token as any).token ||
      (token as any).jwt ||
      (token as any).value ||
      null;

    if (typeof candidate === 'string') {
      const cleaned = candidate.replace(/^"+|"+$/g, '').trim();
      return cleaned || null;
    }
  }

  try {
    const asString = JSON.stringify(token);
    return asString || null;
  } catch {
    return String(token || '').trim() || null;
  }
}

function loadUserFromStorage(): AuthUser | null {
  try {
    const storedUser = localStorage.getItem('rt_user');
    if (!storedUser) return null;

    const parsed = JSON.parse(storedUser);
    return normalizeStoredUser(parsed);
  } catch (err) {
    console.error('AuthProvider: failed to parse rt_user', err);
    localStorage.removeItem('rt_user');
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const normalizedUser = loadUserFromStorage();
    const normalizedToken = getStoredToken();

    setUser(normalizedUser);
    setToken(normalizedToken);
    setReady(true);
  }, []);

  useEffect(() => {
    const onStorage = () => {
      const normalizedUser = loadUserFromStorage();
      const normalizedToken = getStoredToken();

      setUser(normalizedUser);
      setToken(normalizedToken);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = (userData: unknown, tokenData: unknown) => {
    try {
      const normalizedUser = normalizeStoredUser(userData);
      const normalizedToken = normalizeToken(tokenData);

      if (normalizedUser) {
        localStorage.setItem('rt_user', JSON.stringify(normalizedUser));
        setUser(normalizedUser);
      }

      if (normalizedToken) {
        persistStoredToken(normalizedToken);
        setToken(normalizedToken);
      }
    } catch (err) {
      console.error('AuthProvider: failed to save auth data', err);
    }
  };

  const updateUser = (userData: unknown) => {
    try {
      const normalized = normalizeStoredUser(userData);
      if (!normalized) return;

      localStorage.setItem('rt_user', JSON.stringify(normalized));
      setUser(normalized);
    } catch (err) {
      console.error('AuthProvider: failed to update user', err);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      ready,
      token,
      isAuthenticated: !!user && !!token,
      login,
      logout,
      updateUser,
    }),
    [user, ready, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
