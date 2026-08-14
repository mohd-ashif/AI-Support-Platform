import { configureStore, createSlice } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import sourcesReducer from "./slices/sourcesSlice";
import teamReducer from "./slices/teamSlice";
import widgetReducer from "./slices/widgetSlice";

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    sidebarOpen: true,
  },
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { toggleSidebar } = uiSlice.actions;

export const store = configureStore({
  reducer: {
    ui: uiSlice.reducer,
    auth: authReducer,
    sources: sourcesReducer,
    team: teamReducer,
    widget: widgetReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
