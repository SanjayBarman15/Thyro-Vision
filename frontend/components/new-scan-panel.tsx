// frontend/components/new-scan-panel.tsx
"use client";

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2,
  Loader2, Sparkles, UserPlus, UserSearch, Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { goeyToast as toast } from "@/components/ui/goey-toaster";
import { StepPatientInfo } from "./new-scan/step-patient-info";
import { StepUploadImage } from "./new-scan/step-upload-image";
import { StepReview } from "./new-scan/step-review";
import { useStore } from "@/store/useStore";
import { getTiradsClass } from "@/lib/colors";
import { Badge } from "./ui/badge";

// ── Types ─────────────────────────────────────────────────
interface PatientData {
  first_name:        string;
  last_name:         string;
  dob:               string;
  gender:            string;
  past_medical_data: string;
}

interface ExistingPatient {
  id:               string;
  first_name:       string;
  last_name:        string;
  age:              number;
  gender:           string;
  next_followup_date: string | null;
  latest_tirads:    number | null;
  total_scans:      number;
  dob?:             string | null;
}

// ── Existing patient search ───────────────────────────────
function ExistingPatientSearch({
  onSelect,
}: {
  onSelect: (patient: ExistingPatient) => void
}) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<ExistingPatient[]>([]);
  const [loading,  setLoading]  = useState(false);
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase.rpc("search_patients", {
        p_query:   q,
        p_limit:   8,
        p_offset:  0,
        p_tirads:  null,
        p_overdue: false,
      });
      setResults(data || []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleChange = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 300);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Find Existing Patient
        </h3>
        <p className="text-sm text-muted-foreground">
          Search by name or Report ID (TV-TR...)
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2
                            w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="e.g. John Doe or TV-TR4-KXM-2847"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          className="pl-9 h-11"
          autoFocus
        />
      </div>

      {/* Results */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No patients found — you may want to create a new patient
          </p>
        )}

        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full flex items-center justify-between p-3
                        bg-muted/30 hover:bg-muted/60 border border-border/60
                        hover:border-primary/40 rounded-xl text-left
                        transition-all group"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground
                             group-hover:text-primary transition-colors">
                {p.first_name} {p.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.age}y · {p.gender} ·{" "}
                {p.total_scans} scan{p.total_scans !== 1 ? "s" : ""}
              </p>
            </div>
            {p.latest_tirads && (
              <Badge
                variant="outline"
                className={`${getTiradsClass(`TR${p.latest_tirads}`)}
                            font-mono text-xs font-bold`}
              >
                TR{p.latest_tirads}
              </Badge>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function NewScanPanel() {
  const {
    isNewScanOpen:   isOpen,
    setIsNewScanOpen,
    fetchDashboardData,
  } = useStore();

  const onClose = useCallback(() => setIsNewScanOpen(false), [setIsNewScanOpen]);

  // ── Mode: 'choose' | 'new' | 'existing' ──────────────────
  const [mode, setMode] = useState<"choose" | "new" | "existing">("choose");

  const [step,             setStep]             = useState(1);
  const [isLoading,        setIsLoading]        = useState(false);
  const [showMedical,      setShowMedical]      = useState(false);
  const [createdPatientId, setCreatedPatientId] = useState<string | null>(null);
  const [selectedPatient,  setSelectedPatient]  = useState<ExistingPatient | null>(null);

  const router   = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState<PatientData>({
    first_name: "", last_name: "", dob: "", gender: "",
    past_medical_data: "",
  });

  const [imageFile,  setImageFile]  = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [useLlm,     setUseLlm]     = useState(true);

  // ── Reset on close ────────────────────────────────────────
  const handleClose = useCallback(() => {
    setMode("choose");
    setStep(1);
    setFormData({ first_name: "", last_name: "", dob: "", gender: "",
                  past_medical_data: "" });
    setImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setShowMedical(false);
    setCreatedPatientId(null);
    setSelectedPatient(null);
    onClose();
  }, [onClose, previewUrl]);

  // Preview URL lifecycle
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  // Contextual pre-selection (e.g. from Patient Detail page)
  useEffect(() => {
    if (isOpen) {
      const preId = sessionStorage.getItem("preselectPatientId");
      const preName = sessionStorage.getItem("preselectPatientName");
      const preGender = sessionStorage.getItem("preselectGender");
      const preAge = sessionStorage.getItem("preselectAge");
      const preDob = sessionStorage.getItem("preselectDob");

      if (preId && preName) {
        const parts = preName.split(" ");
        const firstName = parts[0] || "";
        const lastName = parts.slice(1).join(" ") || "";

        setSelectedPatient({
          id: preId,
          first_name: firstName,
          last_name: lastName,
          gender: preGender || "—",
          age: parseInt(preAge || "0"),
          next_followup_date: null,
          latest_tirads: null,
          total_scans: 0,
          dob: preDob || null,
        });
        setCreatedPatientId(preId);
        setMode("existing");
        setStep(1); // Jump to Upload Image

        // Clear after reading
        sessionStorage.removeItem("preselectPatientId");
        sessionStorage.removeItem("preselectPatientName");
        sessionStorage.removeItem("preselectGender");
        sessionStorage.removeItem("preselectAge");
        sessionStorage.removeItem("preselectDob");
      }
    }
  }, [isOpen]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    }, []);

  const handleFileChange = useCallback((file: File) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "application/dicom"];
    if (!allowed.includes(file.type) && !file.name.toLowerCase().endsWith(".dcm")) {
      toast.error("Invalid file type. Please upload PNG, JPG, or DICOM.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size exceeds 50MB limit.");
      return;
    }
    setImageFile(file);
    toast.success("Image selected successfully");
  }, []);

  const validateStep = useCallback((s: number) => {
    if (s === 1 && mode === "new") {
      return !!(formData.first_name && formData.last_name &&
                formData.dob && formData.gender);
    }
    const imageStep = mode === "new" ? 2 : 1;
    if (s === imageStep) return !!imageFile;
    return true;
  }, [formData, imageFile, mode]);

  const handleNext = useCallback(() => {
    if (step === 1 && mode === "new" &&
        new Date(formData.dob) > new Date()) {
      toast.error("Date of birth cannot be in the future");
      return;
    }
    const maxStep = mode === "new" ? 3 : 2;
    if (step < maxStep && validateStep(step)) setStep(step + 1);
  }, [step, validateStep, formData.dob, mode]);

  // ── Select existing patient → skip patient info step ─────
  const handleSelectExistingPatient = (p: ExistingPatient) => {
    setSelectedPatient(p);
    setCreatedPatientId(p.id);
    setMode("existing");
    setStep(1); // Step 1 for existing = upload image
  };

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) throw new Error("Authentication failed.");

      const token      = session.access_token;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      // 1. Create or reuse patient
      let patientId = createdPatientId;
      if (!patientId) {
        const res = await fetch(`${backendUrl}/patients/`, {
          method:  "POST",
          headers: { "Content-Type": "application/json",
                     Authorization: `Bearer ${token}` },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to create patient record");
        }
        const data = await res.json();
        patientId  = data.patient.id;
        setCreatedPatientId(patientId);
      }

      // 2. Upload image
      const imageFormData = new FormData();
      imageFormData.append("patient_id", patientId as string);
      imageFormData.append("file", imageFile!);

      const imgRes = await fetch(`${backendUrl}/images/upload-raw`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    imageFormData,
      });
      if (!imgRes.ok) {
        const err = await imgRes.json();
        throw new Error(`Image upload failed: ${err.detail || imgRes.statusText}`);
      }
      const { image_id: imageId } = await imgRes.json();

      // 3. Inference
      toast.info("Starting AI Analysis...", {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
      });
      const infRes = await fetch(`${backendUrl}/inference/run`, {
        method:  "POST",
        headers: { "Content-Type": "application/json",
                   Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image_id: imageId }),
      });
      if (!infRes.ok) {
        const err = await infRes.json();
        throw new Error(`AI analysis failed: ${err.detail || "Unknown error"}`);
      }
      const { prediction: { id: predictionId } } = await infRes.json();

      // 4. Explanation
      toast.info(useLlm ? "Generating AI Explanation..." : "Finalizing...", {
        icon: <Sparkles className="h-4 w-4 text-primary animate-pulse" />,
      });
      const explRes = await fetch(
        `${backendUrl}/inference/${predictionId}/explain`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json",
                     Authorization: `Bearer ${token}` },
          body: JSON.stringify({ use_llm: useLlm }),
        }
      );
      if (!explRes.ok) {
        toast.warning("Analysis complete, but explanation was skipped.");
      }

      toast.success("Analysis complete!");
      fetchDashboardData();
      handleClose();
      router.push(`/dashboard/analysis/${predictionId}`);
      router.refresh();

    } catch (error: any) {
      console.error("[SubmissionError]", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard nav
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") handleClose();
      if (e.key === "Enter" && !isLoading && mode !== "choose") {
        const maxStep = mode === "new" ? 3 : 2;
        if (step < maxStep) handleNext();
        else handleSubmit();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, step, handleNext, handleClose, isLoading, mode]);

  if (!isOpen) return null;

  const maxStep   = mode === "new" ? 3 : 2;
  const stepLabel = mode === "new"
    ? ["Patient Info", "Upload Image", "Review"]
    : ["Upload Image", "Review"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog"
         aria-modal="true">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm
                    animate-in fade-in duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg flex flex-col bg-card
                       border-l border-border shadow-2xl
                       animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b
                         border-border bg-card/80 backdrop-blur sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
              New Scan
              {isLoading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            </h2>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
              {mode === "existing" && selectedPatient
                ? `${selectedPatient.first_name} ${selectedPatient.last_name} — existing patient`
                : "ThyroVision Intelligent Analysis"
              }
            </p>
          </div>
          <button onClick={handleClose}
            className="p-2 rounded-full hover:bg-muted transition-colors
                        text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Choose mode ── */}
        {mode === "choose" && (
          <div className="flex-1 flex flex-col items-center justify-center
                           p-8 gap-4">
            <h3 className="text-lg font-semibold text-center">
              Is this a new or returning patient?
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              For returning patients, select their existing record to keep
              scan history together.
            </p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-4">
              <button
                onClick={() => { setMode("new"); setStep(1); }}
                className="flex flex-col items-center gap-3 p-6 bg-muted/30
                            hover:bg-primary/10 border border-border/60
                            hover:border-primary/40 rounded-xl transition-all group"
              >
                <UserPlus className="w-8 h-8 text-muted-foreground
                                      group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold">New Patient</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    First visit
                  </p>
                </div>
              </button>
              <button
                onClick={() => { setMode("existing"); setStep(0); }}
                className="flex flex-col items-center gap-3 p-6 bg-muted/30
                            hover:bg-primary/10 border border-border/60
                            hover:border-primary/40 rounded-xl transition-all group"
              >
                <UserSearch className="w-8 h-8 text-muted-foreground
                                        group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="text-sm font-semibold">Existing Patient</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Follow-up scan
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── Existing patient: search ── */}
        {mode === "existing" && step === 0 && (
          <div className="flex-1 overflow-y-auto p-8">
            <ExistingPatientSearch onSelect={handleSelectExistingPatient} />
          </div>
        )}

        {/* ── Step indicator (only when past choose/search) ── */}
        {mode !== "choose" && step > 0 && (
          <div className="px-6 py-4 bg-muted/20">
            <div className="flex items-center gap-3">
              {stepLabel.map((label, i) => (
                <div key={label} className="flex-1 flex flex-col gap-1.5">
                  <div className={`h-1.5 w-full rounded-full transition-all
                                    duration-500
                                    ${i + 1 <= step
                                      ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)]"
                                      : "bg-border"}`}
                  />
                  <span className={`text-[10px] font-bold uppercase
                                     ${i + 1 === step
                                       ? "text-primary"
                                       : "text-muted-foreground opacity-50"}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step content ── */}
        {mode !== "choose" && step > 0 && (
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-md mx-auto">

              {/* New patient steps */}
              {mode === "new" && step === 1 && (
                <StepPatientInfo
                  data={formData}
                  onChange={handleInputChange}
                  onToggleMedical={() => setShowMedical(!showMedical)}
                  showMedical={showMedical}
                />
              )}
              {mode === "new" && step === 2 && (
                <StepUploadImage
                  file={imageFile}
                  previewUrl={previewUrl}
                  onFileChange={handleFileChange}
                />
              )}
              {mode === "new" && step === 3 && (
                <StepReview
                  data={formData}
                  file={imageFile}
                  previewUrl={previewUrl}
                  useLlm={useLlm}
                  onToggleLlm={setUseLlm}
                />
              )}

              {/* Existing patient steps */}
              {mode === "existing" && step === 1 && (
                <StepUploadImage
                  file={imageFile}
                  previewUrl={previewUrl}
                  onFileChange={handleFileChange}
                />
              )}
              {mode === "existing" && step === 2 && (
                <StepReview
                  data={{
                    first_name:        selectedPatient?.first_name || "",
                    last_name:         selectedPatient?.last_name  || "",
                    dob:               selectedPatient?.dob || "",
                    gender:            selectedPatient?.gender     || "",
                    past_medical_data: "",
                  }}
                  file={imageFile}
                  previewUrl={previewUrl}
                  useLlm={useLlm}
                  onToggleLlm={setUseLlm}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Footer buttons ── */}
        {mode !== "choose" && step > 0 && (
          <div className="p-6 bg-card border-t border-border flex
                           items-center gap-4 sticky bottom-0 z-10">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 1 && mode === "existing") {
                  setStep(0); // back to search
                } else if (step === 1) {
                  setMode("choose");
                } else {
                  setStep(step - 1);
                }
              }}
              disabled={isLoading}
              className="flex-1 h-12 gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            {step < maxStep ? (
              <Button
                onClick={handleNext}
                disabled={!validateStep(step)}
                className="flex-[2] h-12 gap-2 bg-primary
                           hover:bg-primary/90 text-primary-foreground"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-[2] h-12 gap-2 bg-primary
                           hover:bg-primary/90 text-primary-foreground"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Start Analysis
                  </>
                )}
              </Button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}