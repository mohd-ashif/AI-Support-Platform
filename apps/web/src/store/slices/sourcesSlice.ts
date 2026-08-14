import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface WebSource {
  id: string;
  workspace_id: string;
  url: string;
  status: string;
  page_count: number;
  last_crawled_at?: string | null;
  error_message?: string | null;
}

export interface FileSource {
  id: string;
  workspace_id: string;
  filename: string;
  file_size_bytes: number;
  cloudinary_url: string;
  status: string;
  error_message?: string | null;
}

export interface ListState<T> {
  items: T[];
  status: "idle" | "loading" | "success" | "error";
  lastFetchedAt: number | null;
  version: number | null;
  error?: string | null;
}

export interface SourcesState {
  web: ListState<WebSource>;
  files: ListState<FileSource>;
}

const initialListState = <T>(): ListState<T> => ({
  items: [],
  status: "idle",
  lastFetchedAt: null,
  version: null,
  error: null,
});

const initialState: SourcesState = {
  web: initialListState<WebSource>(),
  files: initialListState<FileSource>(),
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    setWebSourcesLoading: (state) => {
      state.web.status = "loading";
    },
    setWebSourcesSuccess: (state, action: PayloadAction<{ items: WebSource[]; version?: number }>) => {
      state.web.items = action.payload.items;
      state.web.status = "success";
      state.web.lastFetchedAt = Date.now();
      if (action.payload.version !== undefined) {
        state.web.version = action.payload.version;
      }
      state.web.error = null;
    },
    setWebSourcesError: (state, action: PayloadAction<string>) => {
      state.web.status = "error";
      state.web.error = action.payload;
    },
    addWebSource: (state, action: PayloadAction<WebSource>) => {
      state.web.items.unshift(action.payload);
      state.web.lastFetchedAt = Date.now();
      if (state.web.version !== null) {
        state.web.version += 1;
      }
    },
    removeWebSource: (state, action: PayloadAction<string>) => {
      state.web.items = state.web.items.filter((item) => item.id !== action.payload);
      state.web.lastFetchedAt = Date.now();
      if (state.web.version !== null) {
        state.web.version += 1;
      }
    },
    updateWebSource: (state, action: PayloadAction<WebSource>) => {
      const idx = state.web.items.findIndex((item) => item.id === action.payload.id);
      if (idx !== -1) {
        state.web.items[idx] = action.payload;
      }
      state.web.lastFetchedAt = Date.now();
    },

    setFileSourcesLoading: (state) => {
      state.files.status = "loading";
    },
    setFileSourcesSuccess: (state, action: PayloadAction<{ items: FileSource[]; version?: number }>) => {
      state.files.items = action.payload.items;
      state.files.status = "success";
      state.files.lastFetchedAt = Date.now();
      if (action.payload.version !== undefined) {
        state.files.version = action.payload.version;
      }
      state.files.error = null;
    },
    setFileSourcesError: (state, action: PayloadAction<string>) => {
      state.files.status = "error";
      state.files.error = action.payload;
    },
    addFileSource: (state, action: PayloadAction<FileSource>) => {
      state.files.items.unshift(action.payload);
      state.files.lastFetchedAt = Date.now();
      if (state.files.version !== null) {
        state.files.version += 1;
      }
    },
    removeFileSource: (state, action: PayloadAction<string>) => {
      state.files.items = state.files.items.filter((item) => item.id !== action.payload);
      state.files.lastFetchedAt = Date.now();
      if (state.files.version !== null) {
        state.files.version += 1;
      }
    },
    updateFileSource: (state, action: PayloadAction<FileSource>) => {
      const idx = state.files.items.findIndex((item) => item.id === action.payload.id);
      if (idx !== -1) {
        state.files.items[idx] = action.payload;
      }
      state.files.lastFetchedAt = Date.now();
    },
    resetSourcesState: () => initialState,
  },
});

export const {
  setWebSourcesLoading,
  setWebSourcesSuccess,
  setWebSourcesError,
  addWebSource,
  removeWebSource,
  updateWebSource,
  setFileSourcesLoading,
  setFileSourcesSuccess,
  setFileSourcesError,
  addFileSource,
  removeFileSource,
  updateFileSource,
  resetSourcesState,
} = sourcesSlice.actions;

export default sourcesSlice.reducer;
