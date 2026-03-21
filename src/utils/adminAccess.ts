const SUPERADMIN_SESSION_KEY = 'rifaticket.superadmin.session';

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

function parseCsv(raw?: string | null) {
  return String(raw || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function getAllowedSuperAdminEmails() {
  return parseCsv(import.meta.env.VITE_SUPERADMIN_EMAILS);
}

export function isAllowedSuperAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  return getAllowedSuperAdminEmails().includes(normalized);
}

export function isSuperAdminUser(user: any) {
  return isAllowedSuperAdminEmail(user?.email);
}

export function getSuperAdminPin() {
  return String(import.meta.env.VITE_SUPERADMIN_PIN || '').trim();
}

export function requiresSuperAdminPin() {
  return Boolean(getSuperAdminPin());
}

export function hasSuperAdminSession() {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SUPERADMIN_SESSION_KEY) === 'ok';
}

export function grantSuperAdminSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SUPERADMIN_SESSION_KEY, 'ok');
}

export function clearSuperAdminSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SUPERADMIN_SESSION_KEY);
}

export function getMaskedAdminEmails() {
  const emails = getAllowedSuperAdminEmails();

  return emails.map((email) => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    if (name.length <= 2) return `${name[0] || '*'}*@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  });
}