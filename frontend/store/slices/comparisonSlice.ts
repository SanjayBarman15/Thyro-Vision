// store/slices/comparisonSlice.ts
import { StateCreator } from "zustand";
import { createClient } from "@/utils/supabase/client";
import { AppState, ComparisonSlice } from "../types";

const supabase = createClient();

export const createComparisonSlice: StateCreator<
  AppState,
  [],
  [],
  ComparisonSlice
> = (set) => ({
  fetchingComparison: false,
  comparisonSummary:  null,

  fetchComparison: async (patientId, idA, idB) => {
    set({ fetchingComparison: true, comparisonSummary: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/v1/patients/${patientId}/compare?id_a=${idA}&id_b=${idB}`, {
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      });

      if (!res.ok) throw new Error("Failed to fetch comparison");
      const data = await res.json();
      
      set({ comparisonSummary: data.comparison });
    } catch (err) {
      console.error("Error fetching AI comparison:", err);
      set({ comparisonSummary: "Error: AI comparison could not be generated." });
    } finally {
      set({ fetchingComparison: false });
    }
  },
});
