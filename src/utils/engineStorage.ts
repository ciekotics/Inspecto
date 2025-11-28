import {mmkv} from '../store/mmkv';

export type EngineDraftStatus = 'draft' | 'pending-sync' | 'synced';

export type EngineDraft = {
  sellCarId: string;
  data: any;
  updatedAt: number;
  status: EngineDraftStatus;
  lastSyncError?: string | null;
};

export type EngineQueueItem = {
  id: string;
  sellCarId: string;
  payload: {
    engineInfo: any;
    chassisUri?: string | null;
    insuranceUri?: string | null;
  };
  enqueuedAt: number;
  attempts: number;
};

const draftKey = (sellCarId: string) => `engine:draft:${sellCarId}`;
const queueKey = 'engine:queue';

export const loadEngineDraft = (sellCarId: string): EngineDraft | null => {
  try {
    const raw = mmkv.getString(draftKey(sellCarId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as EngineDraft;
  } catch {
    return null;
  }
};

export const saveEngineDraft = (draft: EngineDraft) => {
  try {
    mmkv.set(draftKey(draft.sellCarId), JSON.stringify(draft));
  } catch {}
};

export const clearEngineDraft = (sellCarId: string) => {
  try {
    mmkv.delete(draftKey(sellCarId));
  } catch {}
};

const readQueue = (): EngineQueueItem[] => {
  try {
    const raw = mmkv.getString(queueKey);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as EngineQueueItem[];
  } catch {
    return [];
  }
};

const writeQueue = (items: EngineQueueItem[]) => {
  try {
    mmkv.set(queueKey, JSON.stringify(items));
  } catch {}
};

export const enqueueEngineSync = (item: EngineQueueItem) => {
  const list = readQueue();
  list.push(item);
  writeQueue(list);
};

export const dequeueEngineSync = (id: string) => {
  const list = readQueue().filter(item => item.id !== id);
  writeQueue(list);
};

export const peekEngineQueue = (): EngineQueueItem[] => readQueue();

