import { MemoryStore, type KeyValueStore } from '@core/save/KeyValueStore';

// localStorage can throw (private mode, blocked storage); fall back to memory.
export function createBrowserStore(): KeyValueStore {
  try {
    const probe = '__farm_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return new MemoryStore();
  }
}
