import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import type {DraftModule} from '../../utils/draftStorage';

export type DraftState = Record<string, Partial<Record<DraftModule, any>>>;

const initialState: DraftState = {};

const formDraftsSlice = createSlice({
  name: 'formDrafts',
  initialState,
  reducers: {
    setDraft(
      state,
      action: PayloadAction<{
        sellCarId: string;
        module: DraftModule;
        data: any;
      }>,
    ) {
      const {sellCarId, module, data} = action.payload;
      if (!sellCarId || !module) return;
      if (!state[sellCarId]) {
        state[sellCarId] = {};
      }
      state[sellCarId][module] = data;
    },
    clearDraft(
      state,
      action: PayloadAction<{sellCarId: string; module: DraftModule}>,
    ) {
      const {sellCarId, module} = action.payload;
      if (state[sellCarId]) {
        delete state[sellCarId][module];
        if (Object.keys(state[sellCarId]).length === 0) {
          delete state[sellCarId];
        }
      }
    },
  },
});

export const {setDraft, clearDraft} = formDraftsSlice.actions;
export default formDraftsSlice.reducer;
