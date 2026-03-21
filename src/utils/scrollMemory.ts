const SCROLL_PREFIX = 'rt_scroll:';

function buildKey(pathname: string) {
  return `${SCROLL_PREFIX}${pathname}`;
}

export function getScrollKey(pathname?: string) {
  const path = pathname || window.location.pathname;
  return buildKey(path);
}

export function saveScrollPosition(pathname?: string, y?: number) {
  const key = getScrollKey(pathname);
  const scrollY = typeof y === 'number' ? y : window.scrollY;
  sessionStorage.setItem(key, String(scrollY));
}

export function readScrollPosition(pathname?: string) {
  const key = getScrollKey(pathname);
  const raw = sessionStorage.getItem(key);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function clearScrollPosition(pathname?: string) {
  const key = getScrollKey(pathname);
  sessionStorage.removeItem(key);
}

export function saveCurrentScrollForReturn(pathname?: string) {
  saveScrollPosition(pathname);
}