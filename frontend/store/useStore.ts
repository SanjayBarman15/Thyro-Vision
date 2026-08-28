// frontend/store/useStore.ts
import { create } from "zustand";
import { AppState } from "./types";
import { createProfileSlice } from "./slices/profileSlice";
import { createDashboardSlice } from "./slices/dashboardSlice";
import { createPatientDetailSlice } from "./slices/patientDetailSlice";
import { createSearchSlice } from "./slices/searchSlice";
import { createUiSlice } from "./slices/uiSlice";
import { createComparisonSlice } from "./slices/comparisonSlice";

export * from "./types";

export const useStore = create<AppState>((...a) => ({
  ...createProfileSlice(...a),
  ...createDashboardSlice(...a),
  ...createPatientDetailSlice(...a),
  ...createSearchSlice(...a),
  ...createUiSlice(...a),
  ...createComparisonSlice(...a),
}));