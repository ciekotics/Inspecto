import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export type CalendarSlotsCacheState = {
  slots: any[];
  lastFetchedAt: number | null;
};

const initialState: CalendarSlotsCacheState = {
  slots: [],
  lastFetchedAt: null,
};

const calendarSlotsSlice = createSlice({
  name: 'calendarSlots',
  initialState,
  reducers: {
    setCalendarSlots(
      state,
      action: PayloadAction<{slots: any[]; fetchedAt: number}>,
    ) {
      state.slots = action.payload.slots;
      state.lastFetchedAt = action.payload.fetchedAt;
    },
    clearCalendarSlots(state) {
      state.slots = [];
      state.lastFetchedAt = null;
    },
  },
});

export const {setCalendarSlots, clearCalendarSlots} =
  calendarSlotsSlice.actions;

export default calendarSlotsSlice.reducer;

