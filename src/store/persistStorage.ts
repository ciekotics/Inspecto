import type {Storage} from 'redux-persist';
import {mmkv} from './mmkv';

// MMKV-backed storage adapter for redux-persist (promise-based interface)
export const reduxStorage: Storage = {
  getItem: (key: string) => {
    try {
      const value = mmkv.getString(key);
      return Promise.resolve(value ?? null);
    } catch (e) {
      return Promise.resolve(null);
    }
  },
  setItem: (key: string, value: string) => {
    try {
      mmkv.set(key, value);
    } catch {}
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    try {
      mmkv.delete(key);
    } catch {}
    return Promise.resolve();
  },
};
