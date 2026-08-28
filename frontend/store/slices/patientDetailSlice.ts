// store/slices/patientDetailSlice.ts
import { StateCreator } from "zustand";
import { createClient } from "@/utils/supabase/client";
import { AppState, PatientDetailSlice, Patient, PatientScan, ReportExport } from "../types";

const supabase = createClient();

export const createPatientDetailSlice: StateCreator<
  AppState,
  [],
  [],
  PatientDetailSlice
> = (set, get) => ({
  selectedPatient:      null,
  selectedPatientScans: [],
  selectedPatientReports: [],
  fetchingDetail:       false,

  fetchPatientDetail: async (id) => {
    set({ fetchingDetail: true });
    try {
      const [pRes, sRes, rRes] = await Promise.all([
        supabase.rpc("get_patient_detail", { p_patient_id: id }),
        supabase.rpc("get_patient_scans", { p_patient_id: id }),
        supabase.from("report_exports")
          .select("*")
          .eq("patient_id", id)
          .order("exported_at", { ascending: false })
          .limit(10),
      ]);

      if (pRes.error) throw pRes.error;
      if (sRes.error) throw sRes.error;

      const pRaw = Array.isArray(pRes.data) ? pRes.data[0] : pRes.data;
      if (pRaw) {
        const patient: Patient = {
          id:               pRaw.id,
          name:             `${pRaw.first_name} ${pRaw.last_name}`,
          firstName:        pRaw.first_name,
          lastName:         pRaw.last_name,
          age:              pRaw.age,
          gender:           pRaw.gender,
          dob:                pRaw.dob,
          pastMedicalData:    pRaw.past_medical_data,
          lastScan:         pRaw.created_at, // Fallback
          tirads:           "N/A",
          tiradsNum:        null,
          status:           "new",
          reportId:         null,
          predictionId:     null,
          totalScans:       pRaw.total_scans || 0,
          nextFollowupDate: pRaw.next_followup_date,
          followupNotes:    pRaw.followup_notes,
          isOverdue:        pRaw.next_followup_date ? new Date(pRaw.next_followup_date) < new Date() : false,
        };

        // If we have scans, update latest info
        const scansRaw = (sRes.data as any[]) || [];
        const scans: PatientScan[] = scansRaw.map(s => ({
          rawImageId:       s.raw_image_id,
          fileUrl:           s.file_url,
          uploadedAt:        s.uploaded_at,
          predictionId:      s.prediction_id,
          reportId:          s.report_id,
          tirads:            s.tirads,
          confidence:        s.confidence,
          aiExplanation:     s.ai_explanation,
          followupDueDate:   s.followup_due_date,
          features:          s.features,
          boundingBox:       s.bounding_box,
          processedImageId:  s.processed_image_id,
          processedUrl:      s.processed_url,
        }));

        if (scans.length > 0) {
          const latest = scans[0];
          patient.lastScan = latest.uploadedAt;
          patient.tiradsNum = latest.tirads;
          patient.tirads = latest.tirads ? `TR${latest.tirads}` : "N/A";
          patient.reportId = latest.reportId;
          patient.predictionId = latest.predictionId;
          if (patient.isOverdue) patient.status = "overdue";
          else if (latest.tirads && latest.tirads >= 4) patient.status = "high-risk";
          else patient.status = "reviewed";
        }

        // Format reports
        const reports: ReportExport[] = (rRes.data || []).map((r: any) => ({
          id:              r.id,
          predictionId:    r.prediction_id,
          reportId:        r.report_id,
          exportedAt:      r.exported_at,
          tiradsAtExport:  r.tirads_at_export,
          pipelineVersion: r.pipeline_version,
        }));

        set({ selectedPatient: patient, selectedPatientScans: scans, selectedPatientReports: reports });
      }
    } catch (err) {
      console.error("Error fetching patient detail:", err);
    } finally {
      set({ fetchingDetail: false });
    }
  },
});
