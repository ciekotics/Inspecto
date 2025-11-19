import {createAsyncThunk, createSlice, PayloadAction} from '@reduxjs/toolkit';
import {client} from '../../utils/apiClient';

export type AuthState = {
  token: string | null;
  user: any | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
};

const initialState: AuthState = {
  token: null,
  user: null,
  status: 'idle',
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (payload: {email: string; password: string}, {rejectWithValue}) => {
    try {
      console.log('[auth/login] Request', {
        email: payload.email,
        passwordLength: payload.password.length,
      });
      // API expects { username, password } plus a custom header `type`.
      const res = await client.post(
        '/api/login',
        {username: payload.email, password: payload.password},
        {headers: {type: 'employee'}},
      );
      const data = res.data ?? {};

      // Most responses look like: { status, message, data: { ...user... } }
      const user = data.data ?? data.user ?? null;

      // Try common token shapes from body first.
      let token: string | undefined =
        data.token || data.jwt || data.access_token || data.accessToken;

      // Fall back to Authorization response header if present (e.g. "Bearer <token>")
      if (!token) {
        const authHeader = res.headers?.authorization || res.headers?.Authorization;
        if (typeof authHeader === 'string') {
          const parts = authHeader.split(' ');
          token = parts.length === 2 ? parts[1] : authHeader;
        }
      }

      if (!token) {
        console.error('[auth/login] No token in response', {
          keys: Object.keys(data || {}),
        });
        return rejectWithValue('No token found in response');
      }

      // Authorisation gate based on menu permissions. Only allow users
      // that have full CRUD (view/add/update) on CAR DETAILS or BOOKINGS.
      const menu = user?.menu;
      if (Array.isArray(menu)) {
        const hasModuleAccess = (componentName: string) =>
          menu.some((item: any) => {
            const name = String(item?.componentName || '').toUpperCase();
            if (name !== componentName) {
              return false;
            }
            return item?.view === true && item?.add === true && item?.update === true;
          });

        const allowed =
          hasModuleAccess('CAR DETAILS') || hasModuleAccess('BOOKINGS');

        if (!allowed) {
          console.warn('[auth/login] User lacks required permissions', {
            email: user?.email,
          });
          return rejectWithValue('You are not authorised');
        }
      } else {
        console.warn('[auth/login] No menu data present on user; denying access');
        return rejectWithValue('You are not authorised');
      }

      console.log('[auth/login] Success, token received');
      return {token, user, raw: data};
    } catch (err: any) {
      let msg: string =
        err?.response?.data?.message || err?.message || 'Login failed';

      // Normalize generic backend validation message into something
      // clearer for the user.
      if (msg === 'Validation Error') {
        msg = 'Please check your email and password.';
      }

      console.error('[auth/login] Error', {
        message: msg,
        status: err?.response?.status,
        url: err?.config?.url,
        data: err?.response?.data,
      });
      return rejectWithValue(msg);
    }
  },
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      state.status = 'idle';
      state.error = null;
    },
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.user = action.payload.user ?? null;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = (action.payload as string) || 'Login failed';
      });
  },
});

export const {logout, setToken} = authSlice.actions;
export default authSlice.reducer;
