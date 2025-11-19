import {createSlice, nanoid, PayloadAction} from '@reduxjs/toolkit';

export type PhotoStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type Photo = {
  id: string;
  uri: string; // File path/URI only. Do not store binary data.
  createdAt: number;
  status: PhotoStatus;
  error?: string | null;
};

export type Inspection = {
  id: string;
  createdAt: number;
  updatedAt: number;
  vehicle?: {
    vin?: string;
    plate?: string;
    make?: string;
    model?: string;
    year?: string | number;
  };
  notes?: string;
  photos: Photo[];
};

export type InspectionsState = {
  items: Record<string, Inspection>;
};

const initialState: InspectionsState = {
  items: {},
};

const inspectionsSlice = createSlice({
  name: 'inspections',
  initialState,
  reducers: {
    createInspection: {
      reducer(state, action: PayloadAction<Inspection>) {
        state.items[action.payload.id] = action.payload;
      },
      prepare(partial?: Partial<Inspection>) {
        const id = partial?.id ?? nanoid();
        const now = Date.now();
        return {
          payload: {
            id,
            createdAt: now,
            updatedAt: now,
            vehicle: partial?.vehicle,
            notes: partial?.notes,
            photos: [],
          } as Inspection,
        };
      },
    },
    addPhoto(
      state,
      action: PayloadAction<{inspectionId: string; uri: string; id?: string}>,
    ) {
      const insp = state.items[action.payload.inspectionId];
      if (!insp) return;
      const photo: Photo = {
        id: action.payload.id ?? nanoid(),
        uri: action.payload.uri,
        createdAt: Date.now(),
        status: 'pending',
      };
      insp.photos.push(photo);
      insp.updatedAt = Date.now();
    },
    updatePhotoStatus(
      state,
      action: PayloadAction<{
        inspectionId: string;
        photoId: string;
        status: PhotoStatus;
        error?: string | null;
      }>,
    ) {
      const insp = state.items[action.payload.inspectionId];
      if (!insp) return;
      const p = insp.photos.find(ph => ph.id === action.payload.photoId);
      if (!p) return;
      p.status = action.payload.status;
      p.error = action.payload.error;
      insp.updatedAt = Date.now();
    },
    removeInspection(state, action: PayloadAction<string>) {
      delete state.items[action.payload];
    },
    clearUploadedPhotos(state, action: PayloadAction<string>) {
      const insp = state.items[action.payload];
      if (!insp) return;
      insp.photos = insp.photos.filter(p => p.status !== 'uploaded');
      insp.updatedAt = Date.now();
    },
  },
});

export const {
  createInspection,
  addPhoto,
  updatePhotoStatus,
  removeInspection,
  clearUploadedPhotos,
} = inspectionsSlice.actions;

export default inspectionsSlice.reducer;

