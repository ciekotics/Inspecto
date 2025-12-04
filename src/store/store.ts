import {configureStore, combineReducers} from '@reduxjs/toolkit';
import {persistStore, persistReducer} from 'redux-persist';
import auth from './slices/authSlice';
import inspections from './slices/inspectionsSlice';
import defects from './slices/defectsSlice';
import formDrafts from './slices/formDraftsSlice';
import network from './slices/networkSlice';
import calendarSlots from './slices/calendarSlotsSlice';
import {reduxStorage} from './persistStorage';
import {inspectionApi} from './services/inspectionApi';

const rootPersistConfig = {
  key: 'root',
  storage: reduxStorage,
  blacklist: ['network', 'inspectionApi'], // do not persist online state or RTK query cache
};

const authPersistConfig = {
  key: 'auth',
  storage: reduxStorage,
  whitelist: ['token', 'user'],
};

const inspectionsPersistConfig = {
  key: 'inspections',
  storage: reduxStorage,
  // persist all inspections; photos store URIs only
};

const formDraftsPersistConfig = {
  key: 'formDrafts',
  storage: reduxStorage,
};

const calendarSlotsPersistConfig = {
  key: 'calendarSlots',
  storage: reduxStorage,
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, auth),
  inspections: persistReducer(inspectionsPersistConfig, inspections),
  calendarSlots: persistReducer(calendarSlotsPersistConfig, calendarSlots),
  defects,
  formDrafts: persistReducer(formDraftsPersistConfig, formDrafts),
  [inspectionApi.reducerPath]: inspectionApi.reducer,
  network,
});

const persistedReducer = persistReducer(rootPersistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefault =>
    getDefault({serializableCheck: false, immutableCheck: false}).concat(
      inspectionApi.middleware,
    ), // MMKV/raw data are strings only
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
