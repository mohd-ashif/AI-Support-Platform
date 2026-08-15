import { createStore } from "./createStore";

interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  modalData: any;
  activeTab: string;
  theme: "dark" | "light";

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = createStore<UIState>((set) => ({
  sidebarOpen: true,
  activeModal: null,
  modalData: null,
  activeTab: "overview",
  theme: "dark",

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (modalId, data = null) => set({ activeModal: modalId, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
