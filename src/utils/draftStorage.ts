import {MMKV} from 'react-native-mmkv';

const storage = new MMKV({id: 'inspection_drafts'});
const prefix = 'inspection_draft';

export type DraftModule =
  | 'vehicleDetails'
  | 'engine'
  | 'exterior'
  | 'electrical'
  | 'testDrive'
  | 'functions'
  | 'frames'
  | 'refurbishment'
  | 'defective';

const keyFor = (sellCarId: string | number, module: DraftModule) =>
  `${prefix}:${module}:${sellCarId}`;

export function saveDraft(
  sellCarId: string | number,
  module: DraftModule,
  data: any,
) {
  try {
    const key = keyFor(sellCarId, module);
    storage.set(key, JSON.stringify(data ?? {}));
  } catch (err) {
    console.warn('Failed to save draft', module, err);
  }
}

export function loadDraft<T = any>(
  sellCarId: string | number,
  module: DraftModule,
): T | null {
  try {
    const key = keyFor(sellCarId, module);
    const raw = storage.getString(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('Failed to load draft', module, err);
    return null;
  }
}

export function clearDraft(
  sellCarId: string | number,
  module: DraftModule,
) {
  try {
    const key = keyFor(sellCarId, module);
    storage.delete(key);
  } catch (err) {
    console.warn('Failed to clear draft', module, err);
  }
}
