import { useCallback, useEffect, useRef, useState } from 'react';

/** A single short-lived status message. */
export function useToast(duration = 2600) {
  const [toast, setToast] = useState(null);
  const timer = useRef(0);

  const show = useCallback((message) => {
    clearTimeout(timer.current);
    setToast({ id: performance.now(), message });
    timer.current = setTimeout(() => setToast(null), duration);
  }, [duration]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return [toast, show];
}
