/**
 * usePersistedState Hook
 * Combines useState with localStorage persistence for UI preferences
 * Only use for: filters, tabs, sorts, view modes
 * Never use for: loading states, modals, live data, financial data
 */

import { useState, useCallback } from 'react';
import { safeGet, safeSet } from '../lib/storage';

export function usePersistedState<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => safeGet(key, defaultValue));

  const setPersistedValue = useCallback((newVal: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof newVal === 'function' ? (newVal as (prev: T) => T)(prev) : newVal;
      safeSet(key, resolved);
      return resolved;
    });
  }, [key]);

  return [value, setPersistedValue];
}

export default usePersistedState;
