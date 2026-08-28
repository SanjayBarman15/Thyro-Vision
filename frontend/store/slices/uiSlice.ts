// store/slices/uiSlice.ts
import { StateCreator } from "zustand";
import { AppState, UiSlice } from "../types";

export const createUiSlice: StateCreator<
  AppState,
  [],
  [],
  UiSlice
> = (set) => ({
  isNewScanOpen:    false,
  setIsNewScanOpen: (v) => set({ isNewScanOpen: v }),
  isProfileOpen:    false,
  setIsProfileOpen: (v) => set({ isProfileOpen: v }),
});
