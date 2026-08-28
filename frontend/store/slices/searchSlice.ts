// store/slices/searchSlice.ts
import { StateCreator } from "zustand";
import { AppState, SearchSlice } from "../types";

export const createSearchSlice: StateCreator<
  AppState,
  [],
  [],
  SearchSlice
> = (set, get) => ({
  searchQuery:   "",
  filterTirads:  null,
  filterOverdue: false,
  sortBy:        "recent",

  setSearchQuery: (q) => {
    set({ searchQuery: q });
  },

  setFilterTirads: (t) => {
    set({ filterTirads: t });
    get().fetchDashboardData();
  },

  setFilterOverdue: (v) => {
    set({ filterOverdue: v });
    get().fetchDashboardData();
  },

  setSortBy: (s) => set({ sortBy: s }),

  searchPatients: async () => {
    await get().fetchDashboardData();
  },
});
