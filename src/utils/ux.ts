import Swal from 'sweetalert2';

const sharePromptKey = (scope: string) => `rt_share_prompt_${scope}`;
const LAST_APP_SHARE_KEY = 'rt_last_app_share_prompt_at';

export function openHelpModal(title: string, html: string) {
  return Swal.fire({
    title,
    html: `<div style="text-align:left; line-height:1.8; font-size:15px; color:#334155;">${html}</div>`,
    confirmButtonText: 'Entendido',
    confirmButtonColor: '#3483fa',
    background: '#ffffff',
    color: '#111827',
  });
}

export function getStoredAuthToken() {
  const keys = ['access_token', 'token', 'auth_token', 'rt_token'];

  for (const key of keys) {
    const ls = localStorage.getItem(key);
    const ss = sessionStorage.getItem(key);

    if (ls) return ls;
    if (ss) return ss;
  }

  return '';
}

export function isUserLoggedIn() {
  return Boolean(getStoredAuthToken());
}

function getApiBaseForShare() {
  const raw =
    (
      import.meta.env.VITE_API_PUBLIC_URL ||
      import.meta.env.VITE_API_URL ||
      window.location.origin
    ).replace(/\/+$/, '');

  if (raw.endsWith('/api')) return raw.slice(0, -4);
  return raw;
}

export function buildPublicRaffleLink(raffleId?: string | null, sellerId?: string | null) {
  const safeId = raffleId || '';
  const url = new URL(`${window.location.origin}/raffle/${safeId}`);

  if (sellerId) {
    url.searchParams.set('vendedor', sellerId);
  }

  return url.toString();
}

export function buildShareRaffleLink(raffleId?: string | null, sellerId?: string | null) {
  const safeId = raffleId || '';
  const apiBase = getApiBaseForShare();
  const url = new URL(`${apiBase}/api/raffles/share/${safeId}`);

  if (sellerId) {
    url.searchParams.set('vendedor', sellerId);
  }

  return url.toString();
}

export async function copyText(
  text: string,
  successMessage = 'Mensaje copiado para pegar y compartir.',
) {
  try {
    await navigator.clipboard.writeText(text);

    await Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: successMessage,
      showConfirmButton: false,
      timer: 2200,
      background: '#ffffff',
      color: '#111827',
    });

    return true;
  } catch {
    Swal.fire('Error', 'No se pudo copiar al portapapeles.', 'error');
    return false;
  }
}

export async function shareUrl({
  title,
  text,
  url,
  successMessage = 'Mensaje copiado para compartir.',
}: {
  title: string;
  text: string;
  url: string;
  successMessage?: string;
}) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return true;
    }

    const fullText = `${text}\n\n${url}`;
    return copyText(fullText, successMessage);
  } catch {
    return false;
  }
}

export function openWhatsAppShare(message: string) {
  const encoded = encodeURIComponent(message);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
}

export function setGuidedTourActive(active: boolean) {
  if (active) {
    document.documentElement.setAttribute('data-tour-active', '1');
  } else {
    document.documentElement.removeAttribute('data-tour-active');
  }
}

export function isGuidedTourActive() {
  return document.documentElement.getAttribute('data-tour-active') === '1';
}

export function canShowSharePrompt(scope: string, max = 1) {
  const count = Number(sessionStorage.getItem(sharePromptKey(scope)) || '0');
  return count < max;
}

export function markSharePromptShown(scope: string) {
  const count = Number(sessionStorage.getItem(sharePromptKey(scope)) || '0');
  sessionStorage.setItem(sharePromptKey(scope), String(count + 1));
}

function hoursToMs(hours: number) {
  return hours * 60 * 60 * 1000;
}

function wasShownRecently(key: string, hours: number) {
  const raw = localStorage.getItem(key);
  if (!raw) return false;

  const at = Number(raw);
  if (!at) return false;

  return Date.now() - at < hoursToMs(hours);
}

function markShownNow(key: string) {
  localStorage.setItem(key, String(Date.now()));
}

export async function promptShare(scope: string, opts: { title: string; text: string; url: string }) {
  if (isGuidedTourActive()) return false;
  if (!canShowSharePrompt(scope, 1)) return false;

  markSharePromptShown(scope);

  const res = await Swal.fire({
    title: '¿Querés compartirla?',
    html: `
      <div style="text-align:left; line-height:1.8; font-size:15px; color:#334155;">
        <p>Si querés mover esta rifa más rápido, podés compartirla ahora por WhatsApp.</p>
        <p>Te dejamos el mensaje listo y después seguís usando la app normal.</p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Abrir WhatsApp',
    cancelButtonText: 'Después',
    confirmButtonColor: '#25D366',
    background: '#ffffff',
    color: '#111827',
  });

  if (res.isConfirmed) {
    openWhatsAppShare(opts.text);
    return true;
  }

  return false;
}

export async function promptAppShare(scope: string, url: string) {
  if (isGuidedTourActive()) return false;
  if (!canShowSharePrompt(`${scope}-app`, 1)) return false;
  if (wasShownRecently(LAST_APP_SHARE_KEY, 72)) return false;

  markSharePromptShown(`${scope}-app`);
  markShownNow(LAST_APP_SHARE_KEY);

  const res = await Swal.fire({
    title: '¿Te gustó la app?',
    html: `
      <div style="text-align:left; line-height:1.8; font-size:15px; color:#334155;">
        <p>Si te está resultando útil, podés compartirla con otra persona.</p>
        <p>No hace falta hacerlo ahora mismo, pero te dejamos la opción lista.</p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Abrir WhatsApp',
    cancelButtonText: 'Más tarde',
    confirmButtonColor: '#25D366',
    background: '#ffffff',
    color: '#111827',
  });

  if (res.isConfirmed) {
    openWhatsAppShare(`Mirá esta app para crear y vender rifas de forma simple:\n\n${url}`);
    return true;
  }

  return false;
}

export function runAfterTourAndIdle(
  callback: () => void,
  options?: {
    minDelayMs?: number;
    idleMs?: number;
    timeoutMs?: number;
  }
) {
  const minDelayMs = options?.minDelayMs ?? 18000;
  const idleMs = options?.idleMs ?? 12000;
  const timeoutMs = options?.timeoutMs ?? 180000;

  let ready = false;
  let idleTimer: number | undefined;
  let killed = false;
  const startedAt = Date.now();

  const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

  const cleanup = () => {
    if (idleTimer) window.clearTimeout(idleTimer);
    events.forEach((event) => window.removeEventListener(event, onUserActivity));
  };

  const tryRun = () => {
    if (killed) return;

    if (Date.now() - startedAt > timeoutMs) {
      cleanup();
      return;
    }

    if (isGuidedTourActive()) {
      armIdle();
      return;
    }

    cleanup();
    callback();
  };

  const armIdle = () => {
    if (!ready || killed) return;
    if (idleTimer) window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(tryRun, idleMs);
  };

  const onUserActivity = () => {
    armIdle();
  };

  events.forEach((event) =>
    window.addEventListener(event, onUserActivity, { passive: true }),
  );

  const readyTimer = window.setTimeout(() => {
    ready = true;
    armIdle();
  }, minDelayMs);

  return () => {
    killed = true;
    window.clearTimeout(readyTimer);
    cleanup();
  };
}