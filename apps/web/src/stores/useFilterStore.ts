import { createStore } from "./createStore";

interface FilterState {
  searchQuery: string;
  analyticsRange: "7d" | "30d" | "90d";
  statusFilter: string;
  selectedCategoryId: string | null;

  setSearchQuery: (query: string) => void;
  setAnalyticsRange: (range: "7d" | "30d" | "90d") => void;
  setStatusFilter: (status: string) => void;
  setSelectedCategoryId: (id: string | null) => void;
  resetFilters: () => void;
}

export const useFilterStore = createStore<FilterState>((set) => ({
  searchQuery: "",
  analyticsRange: "7d",
  statusFilter: "all",
  selectedCategoryId: null,

  setSearchQuery: (query) => set({ searchQuery: query }),
  setAnalyticsRange: (range) => set({ analyticsRange: range }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  resetFilters: () => set({ searchQuery: "", statusFilter: "all", selectedCategoryId: null }),
}));
