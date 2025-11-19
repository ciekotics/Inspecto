import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export type NetworkState = {
  isOnline: boolean | null;
};

const initialState: NetworkState = {
  isOnline: null,
};

const networkSlice = createSlice({
  name: 'network',
  initialState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.isOnline = action.payload;
    },
  },
});

export const {setOnline} = networkSlice.actions;
export default networkSlice.reducer;

