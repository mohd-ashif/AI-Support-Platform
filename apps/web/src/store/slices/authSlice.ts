import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { setMemoryAccessToken, setMemoryWorkspaceId } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
}

export interface WorkspaceInfo {
  workspace_id: string;
  role: string;
}

export type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  workspaces: any[];
  selectedWorkspace: any | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  workspaces: [],
  selectedWorkspace: null,
  status: "idle",
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth: (
      state,
      action: PayloadAction<{
        user: User;
        accessToken: string;
        workspaces?: any[];
      }>
    ) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.workspaces = action.payload.workspaces || [];
      if (state.workspaces.length > 0) {
        if (state.selectedWorkspace) {
          const currentId = state.selectedWorkspace.id || state.selectedWorkspace.workspace_id;
          const updatedSelected = state.workspaces.find((w) => (w.id || w.workspace_id) === currentId);
          state.selectedWorkspace = updatedSelected || state.workspaces[0];
        } else {
          state.selectedWorkspace = state.workspaces[0];
        }
        setMemoryWorkspaceId(state.selectedWorkspace.id || state.selectedWorkspace.workspace_id || null);
      }
      state.status = "authenticated";
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      setMemoryAccessToken(action.payload.accessToken);
    },
    setAccessToken: (state, action: PayloadAction<string | null>) => {
      state.accessToken = action.payload;
      state.status = action.payload ? "authenticated" : "unauthenticated";
      state.isAuthenticated = !!action.payload;
      setMemoryAccessToken(action.payload);
    },
    setAuthStatus: (state, action: PayloadAction<AuthStatus>) => {
      state.status = action.payload;
      if (action.payload === "authenticated") {
        state.isAuthenticated = true;
      } else if (action.payload === "unauthenticated") {
        state.isAuthenticated = false;
      }
    },
    setWorkspaces: (state, action: PayloadAction<any[]>) => {
      state.workspaces = action.payload;
      if (action.payload.length > 0) {
        if (state.selectedWorkspace) {
          const currentId = state.selectedWorkspace.id || state.selectedWorkspace.workspace_id;
          const updatedSelected = action.payload.find((w) => (w.id || w.workspace_id) === currentId);
          state.selectedWorkspace = updatedSelected || action.payload[0];
        } else {
          state.selectedWorkspace = action.payload[0];
        }
        setMemoryWorkspaceId(state.selectedWorkspace.id || state.selectedWorkspace.workspace_id || null);
      } else {
        state.selectedWorkspace = null;
        setMemoryWorkspaceId(null);
      }
    },
    setSelectedWorkspace: (state, action: PayloadAction<any | null>) => {
      state.selectedWorkspace = action.payload;
      if (action.payload) {
        setMemoryWorkspaceId(action.payload.id || action.payload.workspace_id || null);
      } else {
        setMemoryWorkspaceId(null);
      }
    },
    logoutUser: (state) => {
      state.user = null;
      state.accessToken = null;
      state.workspaces = [];
      state.selectedWorkspace = null;
      state.status = "unauthenticated";
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      setMemoryAccessToken(null);
      setMemoryWorkspaceId(null);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
      if (action.payload) {
        state.status = "loading";
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setAuth,
  setAccessToken,
  setAuthStatus,
  setWorkspaces,
  setSelectedWorkspace,
  logoutUser,
  setLoading,
  setError,
} = authSlice.actions;

export default authSlice.reducer;
