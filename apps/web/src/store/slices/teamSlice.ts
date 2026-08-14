import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  joined_at: string;
}

export interface ListState<T> {
  items: T[];
  status: "idle" | "loading" | "success" | "error";
  lastFetchedAt: number | null;
  version: number | null;
  error?: string | null;
}

export interface TeamState {
  members: ListState<TeamMember>;
}

const initialState: TeamState = {
  members: {
    items: [],
    status: "idle",
    lastFetchedAt: null,
    version: null,
    error: null,
  },
};

const teamSlice = createSlice({
  name: "team",
  initialState,
  reducers: {
    setTeamMembersLoading: (state) => {
      state.members.status = "loading";
    },
    setTeamMembersSuccess: (state, action: PayloadAction<{ items: TeamMember[]; version?: number }>) => {
      state.members.items = action.payload.items;
      state.members.status = "success";
      state.members.lastFetchedAt = Date.now();
      if (action.payload.version !== undefined) {
        state.members.version = action.payload.version;
      }
      state.members.error = null;
    },
    setTeamMembersError: (state, action: PayloadAction<string>) => {
      state.members.status = "error";
      state.members.error = action.payload;
    },
    addTeamMember: (state, action: PayloadAction<TeamMember>) => {
      state.members.items.push(action.payload);
      state.members.lastFetchedAt = Date.now();
      if (state.members.version !== null) {
        state.members.version += 1;
      }
    },
    updateTeamMemberRole: (state, action: PayloadAction<{ memberId: string; role: string }>) => {
      const idx = state.members.items.findIndex((m) => m.id === action.payload.memberId);
      if (idx !== -1) {
        state.members.items[idx].role = action.payload.role;
      }
      state.members.lastFetchedAt = Date.now();
    },
    removeTeamMember: (state, action: PayloadAction<string>) => {
      state.members.items = state.members.items.filter((m) => m.id !== action.payload);
      state.members.lastFetchedAt = Date.now();
      if (state.members.version !== null) {
        state.members.version += 1;
      }
    },
    resetTeamState: () => initialState,
  },
});

export const {
  setTeamMembersLoading,
  setTeamMembersSuccess,
  setTeamMembersError,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  resetTeamState,
} = teamSlice.actions;

export default teamSlice.reducer;
