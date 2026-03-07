/**
 * Storage Utility for localStorage persistence
 * Safe JSON serialization with error handling
 */

const PREFIX = 'da-';

export function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(PREFIX + key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[Storage] Failed to get "${key}":`, error);
    return defaultValue;
  }
}

export function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[Storage] Failed to set "${key}":`, error);
  }
}

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    console.warn(`[Storage] Failed to remove "${key}":`, error);
  }
}

export function safeClear(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('[Storage] Failed to clear storage:', error);
  }
}
