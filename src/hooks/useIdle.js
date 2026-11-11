import { useEffect, useState } from 'react';

/** True after `ms` without pointer, touch or keyboard activity. */
export function useIdle(ms) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let timer;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    timer = setTimeout(() => setIdle(true), ms);
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [ms]);

  return idle;
}
