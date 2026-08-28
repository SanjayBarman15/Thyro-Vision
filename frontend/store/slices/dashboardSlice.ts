// store/slices/dashboardSlice.ts
import { StateCreator } from "zustand";
import { createClient } from "@/utils/supabase/client";
import { AppState, DashboardSlice, Patient, PatientStatus } from "../types";

const supabase = createClient();

export const createDashboardSlice: StateCreator<
  AppState,
  [],
  [],
  DashboardSlice
> = (set, get) => ({
  patients: [],
  stats: {
    totalPatients:  0,
    scansThisMonth: 0,
    highRiskCount:  0,
    overdueCount:   0,
  },
  loading: true,

  fetchDashboardData: async () => {
    set({ loading: true });
    try {
      // Run stats + patients in parallel
      const [statsResult, patientsResult] = await Promise.all([
        supabase.rpc("get_doctor_stats"),
        supabase.rpc("search_patients", {
          p_query:   get().searchQuery   || null,
          p_tirads:  get().filterTirads  || null,
          p_overdue: get().filterOverdue || false,
          p_limit:   100,
          p_offset:  0,
        }),
      ]);

      // Stats
      const s = statsResult.data?.[0];
      if (s) {
        set({
          stats: {
            totalPatients:  Number(s.total_patients)  || 0,
            scansThisMonth: Number(s.scans_this_month) || 0,
            highRiskCount:  Number(s.high_risk_count)  || 0,
            overdueCount:   Number(s.overdue_count)    || 0,
          },
        });
      }

      // Patients
      if (patientsResult.data) {
        const formatted: Patient[] = patientsResult.data.map((p: any) => {
          const tiradsNum = p.latest_tirads ?? null;
          const isOverdue = p.is_overdue === true;

          let status: PatientStatus = "new";
          if (isOverdue)            status = "overdue";
          else if (tiradsNum >= 4)  status = "high-risk";
          else if (tiradsNum)       status = "reviewed";

          return {
            id:               p.id,
            name:             `${p.first_name} ${p.last_name}`,
            firstName:        p.first_name,
            lastName:         p.last_name,
            age:              p.age || 0,
            gender:           p.gender || "—",
            lastScan:         p.latest_scan_date || p.created_at,
            tirads:           tiradsNum ? `TR${tiradsNum}` : "N/A",
            tiradsNum:        tiradsNum,
            status,
            reportId:         p.latest_report_id   || null,
            predictionId:     p.latest_prediction_id || null,
            totalScans:       p.total_scans || 0,
            nextFollowupDate: p.next_followup_date || null,
            isOverdue,
          };
        });

        set({ patients: formatted });
      }
    } finally {
      set({ loading: false });
    }
  },
});
