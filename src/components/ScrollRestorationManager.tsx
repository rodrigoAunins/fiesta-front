import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { readScrollPosition, saveScrollPosition } from '../utils/scrollMemory';

function restoreScrollWithRetries(targetY: number, tries = 0) {
  const maxTries = 30;
  const doc = document.documentElement;
  const maxScrollableY = Math.max(0, doc.scrollHeight - window.innerHeight);
  const finalY = Math.min(targetY, maxScrollableY);

  window.scrollTo(0, finalY);

  if (tries < maxTries && maxScrollableY < targetY) {
    window.setTimeout(() => restoreScrollWithRetries(targetY, tries + 1), 120);
  }
}

export default function ScrollRestorationManager() {
  const location = useLocation();

  // usamos solo pathname para que /create y /create?mp_linked=true
  // compartan la misma memoria de scroll
  const routeKey = location.pathname;

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const save = () => saveScrollPosition(routeKey);

    const onScroll = () => {
      window.clearTimeout((onScroll as any)._t);
      (onScroll as any)._t = window.setTimeout(save, 120);
    };

    const savedY = readScrollPosition(routeKey);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScrollWithRetries(savedY);
      });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        save();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      save();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', save);
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearTimeout((onScroll as any)._t);
    };
  }, [routeKey]);

  return null;
}