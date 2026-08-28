// store/slices/profileSlice.ts
import { StateCreator } from "zustand";
import { createClient } from "@/utils/supabase/client";
import { AppState, ProfileSlice } from "../types";

const supabase = createClient();

export const createProfileSlice: StateCreator<
  AppState,
  [],
  [],
  ProfileSlice
> = (set, get) => ({
  doctorName: "",
  profile: { name: "", age: "", department: "", hospital: "" },

  setProfile: (profile) =>
    set((state) => ({ profile: { ...state.profile, ...profile } })),

  fetchProfile: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from("doctors")
        .select("name, age, department, hospital")
        .eq("id", user.id)
        .single();

      // If record is missing (PGRST116), try to create it (Auto-healing)
      if (error && error.code === "PGRST116") {
        const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";
        const { data: newData, error: insertError } = await supabase
          .from("doctors")
          .insert({
            id: user.id,
            name: fallbackName,
            email: user.email,
          })
          .select("name, age, department, hospital")
          .single();

        if (insertError) {
          console.error("fetchProfile: Failed to auto-create profile:", insertError.message);
        } else {
          data = newData;
          error = null;
        }
      } else if (error) {
        console.error("fetchProfile error:", {
          code: error.code,
          message: error.message,
          details: error.details
        });
      }

      const fallbackName = user?.user_metadata?.full_name || user?.user_metadata?.name || "";

      if (data) {
        set({
          doctorName: data.name || fallbackName,
          profile: {
            name:       data.name       || fallbackName,
            age:        data.age?.toString() || "",
            department: data.department || "",
            hospital:   data.hospital   || "",
          },
        });
      } else {
        // Final fallback if both fetch and insert failed
        set({
          doctorName: fallbackName,
          profile: {
            name: fallbackName,
            age: "",
            department: "",
            hospital: ""
          }
        });
      }
    } catch (err) {
      console.error("fetchProfile unexpected error:", err);
    }
  },

  saveProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { profile } = get();
    await supabase
      .from("doctors")
      .update({
        age:        profile.age ? Number(profile.age) : null,
        department: profile.department,
        hospital:   profile.hospital,
      })
      .eq("id", user.id);
    set({ isProfileOpen: false });
  },
});
