// src/services/api.ts

export const getStoredToken = (): string | null => {
  try {
    const raw = localStorage.getItem('rt_token');
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

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
      // no era JSON, seguimos con raw
    }

    const cleaned = raw.replace(/^"+|"+$/g, '').trim();
    return cleaned || null;
  } catch {
    return null;
  }
};

export const persistStoredToken = (token: unknown): void => {
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
};

export const getStoredUser = <T = unknown>(): T | null => {
  try {
    const raw = localStorage.getItem('rt_user');
    if (!raw) return null;

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const persistStoredUser = (user: unknown): void => {
  try {
    if (!user) return;
    localStorage.setItem('rt_user', JSON.stringify(user));
  } catch {
    // noop
  }
};

export const clearStoredAuth = (): void => {
  try {
    localStorage.removeItem('rt_user');
    localStorage.removeItem('rt_token');
  } catch {
    // noop
  }
};