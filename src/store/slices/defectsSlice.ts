import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export type DefectItem = {
  id: string;
  uri: string | null;
  remark: string;
};

export type DefectDraft = {
  items: DefectItem[];
  deletedFiles: string[];
  inspectionId?: string | number | null;
};

type DefectsState = {
  drafts: Record<string, DefectDraft>;
};

const initialState: DefectsState = {
  drafts: {},
};

const ensureDraft = (
  state: DefectsState,
  sellCarId: string,
  fallback?: Partial<DefectDraft>,
) => {
  if (!state.drafts[sellCarId]) {
    state.drafts[sellCarId] = {
      items: fallback?.items || [],
      deletedFiles: fallback?.deletedFiles || [],
      inspectionId: fallback?.inspectionId ?? null,
    };
  }
  return state.drafts[sellCarId];
};

const defectsSlice = createSlice({
  name: 'defects',
  initialState,
  reducers: {
    setDraft(
      state,
      action: PayloadAction<{
        sellCarId: string;
        items?: DefectItem[];
        deletedFiles?: string[];
        inspectionId?: string | number | null;
      }>,
    ) {
      if (!action.payload.sellCarId) return;
      const draft = ensureDraft(state, action.payload.sellCarId);
      if (action.payload.items) {
        draft.items = action.payload.items;
      }
      if (action.payload.deletedFiles) {
        draft.deletedFiles = action.payload.deletedFiles;
      }
      if (action.payload.inspectionId !== undefined) {
        draft.inspectionId = action.payload.inspectionId;
      }
    },
    resetDraft(state, action: PayloadAction<string>) {
      delete state.drafts[action.payload];
    },
  },
});

export const {setDraft, resetDraft} = defectsSlice.actions;
export default defectsSlice.reducer;
