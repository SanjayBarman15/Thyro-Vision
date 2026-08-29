//frontend/app/dashboard/analysis/[id]/page.tsx
"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useCallback, useState, use } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import SplitPane from "@/components/split-pane";
import PatientInfoCard from "@/components/patient-info-card";
import PredictionCard from "@/components/prediction-card";
import ExplanationAccordion from "@/components/explanation-accordion";
import FeedbackForm from "@/components/feedback-form";
import ImageViewer from "@/components/image-viewer";
import AnalysisHeader from "@/components/analysis-header";
import NotFoundState from "@/components/ui/not-found-state";
import DiagnosticAssistant from "@/components/analysis/diagnostic-assistant";
import { UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

export default function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [imageMode, setImageMode] = useState<
    "original" | "processed" | "gradcam"
  >("processed");

  const [patient, setPatient] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [rawImage, setRawImage] = useState<any>(null);
  const [processedImage, setProcessedImage] = useState<any>(null);
  const [isAssistantPinned, setIsAssistantPinned] = useState(false);

  const supabase = createClient();

  // ── Hooks for dynamic signed URLs ────────────────────────
  const { signedUrl: rawUrl } = useSignedUrl(rawImage?.file_path);
  const { signedUrl: processedUrl } = useSignedUrl(processedImage?.file_path);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      let predictionData = null;
      let rawImageData = null;
      let patientData = null;

      // 1. Try fetching as Prediction ID first
      const { data: predById } = await supabase
        .from("predictions")
        .select(`
          *,
          raw_images:raw_image_id (
            *,
            patients:patient_id (*)
          )
        `)
        .eq("id", id)
        .single();

      if (predById) {
        predictionData = predById;
        rawImageData = predById.raw_images;
        patientData = predById.raw_images?.patients;
      } else {
        // 2. Fallback: Try fetching as Patient ID
        const { data: pData } = await supabase
          .from("patients")
          .select("*")
          .eq("id", id)
          .single();

        if (pData) {
          patientData = pData;
          // Fetch latest scan for this patient
          const { data: latestRaw } = await supabase
            .from("raw_images")
            .select("*")
            .eq("patient_id", pData.id)
            .order("uploaded_at", { ascending: false })
            .limit(1)
            .single();

          if (latestRaw) {
            rawImageData = latestRaw;
            // Fetch latest prediction for this image
            const { data: latestPred } = await supabase
              .from("predictions")
              .select("*")
              .eq("raw_image_id", latestRaw.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            predictionData = latestPred;
          }
        }
      }

      // Map data to state
      if (patientData) {
        setPatient({
          id: patientData.id,
          name: `${patientData.first_name} ${patientData.last_name}`,
          firstName: patientData.first_name,
          lastName: patientData.last_name,
          age: patientData.age || (patientData.dob ? new Date().getFullYear() - new Date(patientData.dob).getFullYear() : "N/A"),
          gender: patientData.gender === "M" || patientData.gender === "Male" ? "Male" : "Female",
          scanDate: new Date(rawImageData?.uploaded_at || patientData.created_at).toLocaleDateString(),
        });
      }

      if (rawImageData) {
        setRawImage(rawImageData);
        // Fetch Processed Image
        const { data: procImageData } = await supabase
          .from("processed_images")
          .select("*")
          .eq("raw_image_id", rawImageData.id)
          .single();
        if (procImageData) setProcessedImage(procImageData);
      }

      if (predictionData) {
        const pred = predictionData;
        const clinicalFeatures = pred.features?.clinical_features || {};
        const measurements = pred.features?.measurements || {};
        const uiFeatures: Record<string, string> = {};

        Object.entries(clinicalFeatures).forEach(([key, data]: [string, any]) => {
          uiFeatures[key] = data.value;
        });

        let explanationMeta: any = {};
        try {
          explanationMeta = typeof pred.explanation_metadata === "string"
            ? JSON.parse(pred.explanation_metadata)
            : (pred.explanation_metadata ?? {});
        } catch {
          console.warn("Could not parse explanation_metadata");
        }

        // Handle both nested and flat metadata structures for Grad-CAM
        const gradCamData = explanationMeta?.grad_cam_data
          ? { ...explanationMeta.grad_cam_data, gradcam_available: explanationMeta?.gradcam_available ?? false }
          : explanationMeta?.heatmap // Flat structure fallback
            ? { ...explanationMeta, gradcam_available: explanationMeta?.gradcam_available ?? false }
            : null;

        setAnalysis({
          tirads: `TR${pred.tirads}`,
          confidence: pred.confidence,
          riskLevel: pred.tirads >= 4 ? "high" : pred.tirads >= 3 ? "moderate" : "low",
          explanation: pred.ai_explanation || `Nodule analysis complete. TI-RADS ${pred.tirads} assigned.`,
          features: uiFeatures,
          clinicalFeatures,
          measurements,
          tiradsConfidences: pred.tirads_confidences,
          boundingBox: pred.bounding_box,
          predictionId: pred.id,
          reportId: pred.report_id,
          modelVersion: pred.model_version,
          inferenceTime: pred.inference_time_ms,
          gradCamData,
        });

        // Fetch Feedback
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
          const feedbackRes = await fetch(`${backendUrl}/predictions/${pred.id}/feedback`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (feedbackRes.ok) {
            const data = await feedbackRes.json();
            if (data.feedback) {
              setAnalysis((prev: any) => ({ ...prev, existingFeedback: data.feedback }));
            }
          }
        } catch (err) {
          console.error("Error fetching feedback:", err);
        }
      }

    } catch (error) {
      console.error("Error fetching analysis data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [id, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleZoomIn = useCallback(
    () => setZoomLevel((prev) => Math.min(prev + 0.3, 4)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoomLevel((prev) => Math.max(prev - 0.5, 0.5)),
    [],
  );
  const handleZoomScale = useCallback(
    (delta: number) =>
      setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.5), 4)),
    [],
  );
  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setImageMode("original");
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-background p-8 space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <div className="flex gap-4 h-full">
          <Skeleton className="w-1/3 h-full" />
          <Skeleton className="flex-1 h-full" />
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <NotFoundState
          title="Patient Not Found"
          subtitle="Record Missing"
          description="The patient record associated with this ID could not be found. It may have been archived or deleted."
          icon={UserMinus}
          actionLabel="Go to Dashboard"
          actionHref="/dashboard"
        />
      </div>
    );
  }

  const currentImageUrl = (imageMode === "processed" || imageMode === "gradcam") && processedUrl 
    ? processedUrl 
    : rawUrl;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-sans">
      <AnalysisHeader
        patientName={patient.name}
        scanDate={patient.scanDate}
        predictionId={analysis?.predictionId}
        reportId={analysis?.reportId}
      />

      <main className={cn(
        "flex-1 overflow-hidden relative pb-4 transition-all duration-300",
        isAssistantPinned ? "pr-[400px]" : "px-4 sm:px-6 lg:px-8"
      )}>
        <div className={cn(
           "h-full w-full",
           isAssistantPinned ? "px-4" : ""
        )}>
        <div className="h-full rounded-2xl border border-border/60 bg-card/60 shadow-lg overflow-hidden">
          <SplitPane>
            {/* LEFT PANEL */}
            <div className="h-full overflow-y-auto p-4 lg:p-6 space-y-4 pb-20 custom-scrollbar">
              <PatientInfoCard patient={patient} />
              {analysis ? (
                <>
                  <PredictionCard analysis={analysis} />
                  <ExplanationAccordion analysis={analysis} />
                </>
              ) : (
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
                  No AI analysis results found for this scan.
                </div>
              )}
              <div className="pt-4 border-t border-border mt-6">
                <FeedbackForm
                  predictionId={analysis?.predictionId}
                  existingFeedback={analysis?.existingFeedback}
                  initialClinicalFeatures={analysis?.clinicalFeatures}
                  imageUrl={currentImageUrl || undefined}
                  aiBbox={analysis?.boundingBox}
                  onSuccess={() =>
                    console.log("Feedback submitted successfully")
                  }
                />
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="h-full bg-black relative flex flex-col">
              <ImageViewer
                zoomLevel={zoomLevel}
                imageMode={imageMode}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onReset={handleReset}
                onModeChange={setImageMode}
                onZoomScale={handleZoomScale}
                imageUrl={currentImageUrl || undefined}
                boundingBox={analysis?.boundingBox}
                gradCamData={analysis?.gradCamData}
              />
            </div>
          </SplitPane>
        </div>
        </div>

        {/* Clinical Diagnostic Assistant (Copilot) */}
        {analysis?.predictionId && (
          <DiagnosticAssistant 
             predictionId={analysis.predictionId}
             tiradsLevel={parseInt(analysis?.tirads?.replace("TR", "") || "0")}
             initialContext={analysis}
             onPinChange={setIsAssistantPinned}
          />
        )}
      </main>
    </div>
  );
}
