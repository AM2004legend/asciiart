import { useCallback, useEffect, useState } from 'react';
import { DEFAULTS } from '../config/presets.js';

const STORAGE_KEY = 'asciiart.settings.v2';

// Small screens get finer cells by default so there are enough columns.
function defaults() {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 720;
  return narrow ? { ...DEFAULTS, cellSize: 4 } : DEFAULTS;
}

function load() {
  const base = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    // Only keep known keys, so stale or tampered values can't leak in.
    return Object.fromEntries(
      Object.entries(base).map(([k, v]) => [k, typeof saved[k] === typeof v ? saved[k] : v]),
    );
  } catch {
    return base;
  }
}

/** Settings persisted per browser. */
export function useSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage can be unavailable (private mode, blocked site data). Not fatal.
    }
  }, [settings]);

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), []);
  const reset = useCallback(() => setSettings(defaults()), []);

  return [settings, update, reset];
}
