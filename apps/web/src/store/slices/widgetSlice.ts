import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface WidgetConfigData {
  id: string;
  workspace_id: string;
  brand_name: string;
  tagline?: string | null;
  logo_url?: string | null;
  primary_color: string;
  greeting_message?: string | null;
  content_cards_json?: Array<{ title: string; description: string; icon_name?: string }>;
  updated_at?: string | null;
}

export interface WidgetState {
  config: WidgetConfigData | null;
  status: "idle" | "loading" | "success" | "error";
  lastFetchedAt: number | null;
  version: number | null;
  error?: string | null;
}

const initialState: WidgetState = {
  config: null,
  status: "idle",
  lastFetchedAt: null,
  version: null,
  error: null,
};

const widgetSlice = createSlice({
  name: "widget",
  initialState,
  reducers: {
    setWidgetConfigLoading: (state) => {
      state.status = "loading";
    },
    setWidgetConfigSuccess: (state, action: PayloadAction<{ config: WidgetConfigData; version?: number }>) => {
      state.config = action.payload.config;
      state.status = "success";
      state.lastFetchedAt = Date.now();
      if (action.payload.version !== undefined) {
        state.version = action.payload.version;
      }
      state.error = null;
    },
    setWidgetConfigError: (state, action: PayloadAction<string>) => {
      state.status = "error";
      state.error = action.payload;
    },
    updateWidgetConfigState: (state, action: PayloadAction<Partial<WidgetConfigData>>) => {
      if (state.config) {
        state.config = { ...state.config, ...action.payload };
      }
      state.lastFetchedAt = Date.now();
      if (state.version !== null) {
        state.version += 1;
      }
    },
    resetWidgetState: () => initialState,
  },
});

export const {
  setWidgetConfigLoading,
  setWidgetConfigSuccess,
  setWidgetConfigError,
  updateWidgetConfigState,
  resetWidgetState,
} = widgetSlice.actions;

export default widgetSlice.reducer;
