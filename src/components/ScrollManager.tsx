import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router does not scroll for us. Without this, a footer or menu link such as
 * /#how opens the homepage but stays at the top, and a new page opens part-way down.
 * It also waits for lazy pages to mount and for the mobile menu's scroll lock to clear,
 * which is why those links used to fail on phones and in the installed app.
 */
const ScrollManager = () => {
  const { pathname, hash, key } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    const pathChanged = lastPath.current !== pathname;
    lastPath.current = pathname;

    if (!hash) {
      if (pathChanged) window.scrollTo(0, 0);
      return;
    }

    let id = hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* keep raw id */ }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let tries = 0;
    let timer: number | undefined;

    const go = () => {
      const el = document.getElementById(id);
      const locked = document.body.hasAttribute('data-scroll-locked') || document.body.style.overflow === 'hidden';
      if (el && !locked) {
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      // 60 x 50ms = 3s for a lazy page or a closing menu.
      if (tries++ < 60) timer = window.setTimeout(go, 50);
    };
    go();
    return () => window.clearTimeout(timer);
  }, [pathname, hash, key]);

  return null;
};

export default ScrollManager;
