import {store} from '../store/store';
import {setDraft as setDraftAction, clearDraft as clearDraftAction} from '../store/slices/formDraftsSlice';

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

export function saveDraft(
  sellCarId: string | number,
  module: DraftModule,
  data: any,
) {
  if (!sellCarId) return;
  store.dispatch(
    setDraftAction({
      sellCarId: String(sellCarId),
      module,
      data: data ?? {},
    }),
  );
}

export function loadDraft<T = any>(
  sellCarId: string | number,
  module: DraftModule,
): T | null {
  const state = store.getState() as any;
  return (
    (state?.formDrafts?.[String(sellCarId)]?.[module] as T | undefined) || null
  );
}

export function clearDraft(
  sellCarId: string | number,
  module: DraftModule,
) {
  if (!sellCarId) return;
  store.dispatch(
    clearDraftAction({sellCarId: String(sellCarId), module}),
  );
}
