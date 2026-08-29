//components/feedback-form.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ChevronDown,
  Check,
  X,
  MessageSquare,
  AlertCircle,
  Sparkles,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { feedbackFormClasses } from "@/lib/colors";
import {
  ACR_FEATURES,
  ACRFeature,
  BBoxData,
  calculateTirads,
} from "@/components/admin/curation/annotation/types";
import BBoxCorrectionDialog from "@/components/bbox-correction-dialog";

interface FeedbackFormProps {
  predictionId: string;
  existingFeedback?: any;
  initialClinicalFeatures?: Record<string, any>;
  imageUrl?: string;
  aiBbox?: BBoxData | null;
  onSuccess?: () => void;
}

export default function FeedbackForm({
  predictionId,
  existingFeedback,
  initialClinicalFeatures,
  imageUrl,
  aiBbox,
  onSuccess,
}: FeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctedTirads, setCorrectedTirads] = useState<number | null>(null);
  const [comments, setComments] = useState("");
  const [featureCorrections, setFeatureCorrections] = useState<
    Record<string, { value: string; points: number; description: string }>
  >({});
  const [error, setError] = useState<string | null>(null);

  // ── BBox feedback state ───────────────────────────────────
  const [bboxCorrect, setBboxCorrect] = useState<boolean | null>(null);
  const [correctedBbox, setCorrectedBbox] = useState<BBoxData | null>(null);
  const [isBboxModalOpen, setIsBboxModalOpen] = useState(false);

  const supabase = createClient();

  // ── Calculate real-time ACR points & TI-RADS level ──────────
  const acrKeys = Object.keys(ACR_FEATURES) as (keyof typeof ACR_FEATURES)[];

  const featurePointsBreakdown = acrKeys.map((key) => {
    const correction = featureCorrections[key];
    const baseFeature = initialClinicalFeatures?.[key];
    const points = correction
      ? correction.points
      : (typeof baseFeature?.points === "number" ? baseFeature.points : 0);
    const label = ACR_FEATURES[key].label;
    const isOverridden = !!correction;
    return { key, label, points, isOverridden };
  });

  const totalCalculatedPoints = featurePointsBreakdown.reduce(
    (sum, item) => sum + item.points,
    0,
  );

  const recalculatedTiradsLevel = calculateTirads(totalCalculatedPoints);

  useEffect(() => {
    if (existingFeedback) {
      setSubmitted(true);
      setIsCorrect(existingFeedback.is_correct);
      setCorrectedTirads(existingFeedback.corrected_tirads);
      setComments(existingFeedback.comments || "");
      if (existingFeedback.corrected_features?.feature_corrections) {
        setFeatureCorrections(
          existingFeedback.corrected_features.feature_corrections,
        );
      } else if (existingFeedback.corrected_features?.incorrect_fields) {
        // Fallback for legacy feedback: map string items
        const legacyMap: Record<
          string,
          { value: string; points: number; description: string }
        > = {};
        for (const field of existingFeedback.corrected_features.incorrect_fields) {
          const key = field.toLowerCase().replace(/ /g, "_");
          legacyMap[key] = { value: "incorrect", points: 0, description: field };
        }
        setFeatureCorrections(legacyMap);
      }
      // ── Restore bbox state ──
      if (existingFeedback.corrected_features?.bbox_correct !== undefined) {
        setBboxCorrect(existingFeedback.corrected_features.bbox_correct);
      }
      if (existingFeedback.corrected_features?.corrected_bbox) {
        setCorrectedBbox(existingFeedback.corrected_features.corrected_bbox);
      }
    }
  }, [existingFeedback]);

  const handleSelectFeatureCorrection = (
    featureKey: string,
    option: { value: string; points: number; description: string },
  ) => {
    const updated = {
      ...featureCorrections,
      [featureKey]: option,
    };
    setFeatureCorrections(updated);

    // Auto-sync TI-RADS score with newly calculated points
    let pointsSum = 0;
    for (const key of acrKeys) {
      if (updated[key]) {
        pointsSum += updated[key].points;
      } else if (typeof initialClinicalFeatures?.[key]?.points === "number") {
        pointsSum += initialClinicalFeatures[key].points;
      }
    }
    setCorrectedTirads(calculateTirads(pointsSum));
  };

  const handleRemoveFeatureCorrection = (featureKey: string) => {
    const updated = { ...featureCorrections };
    delete updated[featureKey];
    setFeatureCorrections(updated);

    // Auto-sync TI-RADS score with newly calculated points
    let pointsSum = 0;
    for (const key of acrKeys) {
      if (updated[key]) {
        pointsSum += updated[key].points;
      } else if (typeof initialClinicalFeatures?.[key]?.points === "number") {
        pointsSum += initialClinicalFeatures[key].points;
      }
    }
    setCorrectedTirads(calculateTirads(pointsSum));
  };

  const handleSubmit = async () => {
    if (isCorrect === null) return;
    if (isCorrect === false && correctedTirads === null) {
      setError("Please select the correct TI-RADS level.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

      const response = await fetch(
        `${backendUrl}/predictions/${predictionId}/feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_correct: isCorrect,
            corrected_tirads: isCorrect ? null : correctedTirads,
            corrected_features: isCorrect
              ? null
              : {
                  feature_corrections: featureCorrections,
                  incorrect_fields: Object.keys(featureCorrections),
                  bbox_correct: bboxCorrect ?? true,
                  corrected_bbox: bboxCorrect === false ? correctedBbox : null,
                  bbox_issue: bboxCorrect === false ? (correctedBbox ? "nodule_position_wrong" : null) : null,
                  bbox_hint: null,
                },
            comments: comments || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submitted state ───────────────────────────────────────
  if (submitted) {
    return (
      <div
        className={`${feedbackFormClasses.success.container} rounded-2xl p-5 flex items-center gap-4 shadow-lg border-2`}
      >
        <div
          className={`h-12 w-12 rounded-xl ${feedbackFormClasses.success.iconBg} flex items-center justify-center shrink-0`}
        >
          <CheckCircle2
            className={`h-6 w-6 ${feedbackFormClasses.success.icon}`}
          />
        </div>
        <div className="min-w-0">
          <p
            className={`text-base font-bold ${feedbackFormClasses.success.title}`}
          >
            Feedback recorded
          </p>
          <p
            className={`text-sm ${feedbackFormClasses.success.subtitle} mt-0.5`}
          >
            Thank you for helping us improve model accuracy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 shadow-xl overflow-hidden">

      {/* ── Header strip ── */}
      <div className="bg-primary/5 border-b border-border/50 px-5 py-4
                      flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center
                            rounded-lg bg-primary/15 text-primary">
            <MessageSquare className="h-4 w-4" />
          </span>
          Clinical feedback
        </h3>
        <span className="text-[10px] uppercase tracking-widest font-semibold
                          px-2.5 py-1 rounded-full bg-primary/10 text-primary
                          border border-primary/20">
          Improves accuracy
        </span>
      </div>

      <div className="p-5 space-y-5">

        {/* ── Was prediction correct? ── */}
        <div>
          <p className="text-xs font-semibold text-foreground mb-3">
            Was the AI prediction correct for this scan?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCorrect(true);
                setError(null);
              }}
              className={`cursor-pointer h-11 rounded-xl border-2 transition-all
                          font-medium ${
                isCorrect === true
                  ? `${feedbackFormClasses.correct.bg} ${feedbackFormClasses.correct.border} ${feedbackFormClasses.correct.text} ${feedbackFormClasses.correct.hover}`
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <Check className="h-4 w-4 mr-2" />
              Yes, correct
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCorrect(false);
                setError(null);
              }}
              className={`cursor-pointer h-11 rounded-xl border-2 transition-all
                          font-medium ${
                isCorrect === false
                  ? `${feedbackFormClasses.incorrect.bg} ${feedbackFormClasses.incorrect.border} ${feedbackFormClasses.incorrect.text} ${feedbackFormClasses.incorrect.hover}`
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <X className="h-4 w-4 mr-2" />
              No, incorrect
            </Button>
          </div>
        </div>

        {/* ── Expanded section when incorrect ── */}
        {isCorrect === false && (
          <div className="space-y-5 pt-4 border-t border-dashed border-border/60">

            {/* ── TI-RADS correction ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-muted-foreground
                                   font-bold tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Correct TI-RADS level
                </label>
                <button
                  type="button"
                  onClick={() => setCorrectedTirads(recalculatedTiradsLevel)}
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all cursor-pointer"
                  title="Click to apply recalculated TI-RADS level"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Recalculated: TR{recalculatedTiradsLevel} ({totalCalculatedPoints} pts)
                </button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-11 rounded-xl
                               border-border bg-background/50 font-medium"
                  >
                    <span className="flex items-center gap-2">
                      {correctedTirads ? `TR${correctedTirads}` : "Select level"}
                      {correctedTirads === recalculatedTiradsLevel && (
                        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Matches calculated ({totalCalculatedPoints} pts)
                        </span>
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-(--radix-dropdown-menu-trigger-width) max-w-[300px]
                               rounded-xl border-border bg-popover"
                  align="start"
                >
                  {[1, 2, 3, 4, 5].map((val) => (
                    <DropdownMenuItem
                      key={val}
                      onClick={() => setCorrectedTirads(val)}
                      className="cursor-pointer rounded-lg font-medium flex items-center justify-between"
                    >
                      <span>TI-RADS {val}</span>
                      {val === recalculatedTiradsLevel && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                          Calculated ({totalCalculatedPoints} pts)
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Points breakdown summary */}
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground pt-0.5 px-0.5">
                <span className="font-semibold text-foreground/70">ACR Points:</span>
                {featurePointsBreakdown.map((item) => (
                  <span
                    key={item.key}
                    className={`px-1.5 py-0.5 rounded ${
                      item.isOverridden
                        ? "bg-primary/15 text-primary font-bold"
                        : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {item.label}: {item.points}p
                  </span>
                ))}
                <span className="font-bold text-foreground ml-auto">
                  = {totalCalculatedPoints} pts &rarr; TR{recalculatedTiradsLevel}
                </span>
              </div>
            </div>

            {/* ── Incorrect sub-features ── */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-muted-foreground
                                   font-bold tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3 w-3" />
                  Feature corrections (optional)
                </label>
                {Object.keys(featureCorrections).length > 0 && (
                  <span className="text-[10px] font-semibold text-primary">
                    {Object.keys(featureCorrections).length} feature{Object.keys(featureCorrections).length > 1 ? "s" : ""} adjusted
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {(Object.keys(ACR_FEATURES) as (keyof typeof ACR_FEATURES)[]).map((featureKey) => {
                  const featureDef = ACR_FEATURES[featureKey];
                  const correction = featureCorrections[featureKey];

                  return (
                    <div
                      key={featureKey}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                        correction
                          ? "bg-primary/5 border-primary/40 shadow-xs"
                          : "bg-muted/20 border-border/70 hover:border-border"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {featureDef.label}
                          </span>
                          {correction && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">
                              +{correction.points} pts
                            </span>
                          )}
                        </div>
                        {correction ? (
                          <p className="text-[11px] text-foreground/80 font-medium truncate mt-0.5">
                            {correction.description || correction.value}
                          </p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            Click to correct sub-feature
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={`h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                                correction
                                  ? "border-primary/40 bg-background text-primary hover:bg-primary/10"
                                  : "border-border bg-background/80 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <span>{correction ? "Change" : "Select"}</span>
                              <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="w-72 rounded-xl border-border bg-popover p-1 shadow-xl"
                            align="end"
                          >
                            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40">
                              {featureDef.label} Options
                            </div>
                            {featureDef.options.map((opt) => (
                              <DropdownMenuItem
                                key={opt.value}
                                onClick={() =>
                                  handleSelectFeatureCorrection(featureKey, {
                                    value: opt.value,
                                    points: opt.points,
                                    description: opt.description,
                                  })
                                }
                                className={`cursor-pointer rounded-lg px-2.5 py-2 text-xs flex items-center justify-between gap-2 my-0.5 ${
                                  correction?.value === opt.value
                                    ? "bg-primary/15 text-primary font-semibold"
                                    : "hover:bg-muted"
                                }`}
                              >
                                <span className="truncate">{opt.description}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground shrink-0">
                                  +{opt.points} pts
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {correction && (
                          <button
                            type="button"
                            onClick={() => handleRemoveFeatureCorrection(featureKey)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title="Remove correction"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Nodule detection (BBox) ── */}
            <div className="space-y-3 pt-1 border-t border-dashed border-border/40">
              <label className="text-[10px] uppercase text-muted-foreground
                                 font-bold tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                Nodule detection (optional)
              </label>

              {/* Location correct / incorrect */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setBboxCorrect(true);
                    setCorrectedBbox(null);
                  }}
                  className={`h-10 rounded-xl border-2 text-xs font-medium
                              transition-all cursor-pointer ${
                    bboxCorrect === true
                      ? "bg-green-500/10 border-green-500/40 text-green-400"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Location correct
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBboxCorrect(false);
                    if (imageUrl) {
                      setIsBboxModalOpen(true);
                    }
                  }}
                  className={`h-10 rounded-xl border-2 text-xs font-medium
                              transition-all cursor-pointer ${
                    bboxCorrect === false
                      ? "bg-red-500/10 border-red-500/40 text-red-400"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1.5">
                    <X className="h-3.5 w-3.5" />
                    Location incorrect
                  </span>
                </button>
              </div>

              {/* BBox Drawing Card / Action — only when location incorrect */}
              {bboxCorrect === false && (
                <div className="space-y-3 pt-1">
                  {correctedBbox ? (
                    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs font-semibold text-emerald-300">
                            Corrected Box Applied
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsBboxModalOpen(true)}
                            className="h-7 px-2 text-[11px] rounded-lg border-emerald-500/30 bg-background text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            Edit Box
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCorrectedBbox(null)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive rounded-lg cursor-pointer"
                            title="Clear box"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Coordinates chips */}
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        <div className="bg-background/80 px-2 py-1 rounded-md border border-border/50 text-center">
                          <span className="text-[9px] text-muted-foreground uppercase block font-bold">X</span>
                          <span className="text-[11px] font-mono font-medium text-foreground">{Math.round(correctedBbox.x)}</span>
                        </div>
                        <div className="bg-background/80 px-2 py-1 rounded-md border border-border/50 text-center">
                          <span className="text-[9px] text-muted-foreground uppercase block font-bold">Y</span>
                          <span className="text-[11px] font-mono font-medium text-foreground">{Math.round(correctedBbox.y)}</span>
                        </div>
                        <div className="bg-background/80 px-2 py-1 rounded-md border border-border/50 text-center">
                          <span className="text-[9px] text-muted-foreground uppercase block font-bold">Width</span>
                          <span className="text-[11px] font-mono font-medium text-foreground">{Math.round(correctedBbox.width)}</span>
                        </div>
                        <div className="bg-background/80 px-2 py-1 rounded-md border border-border/50 text-center">
                          <span className="text-[9px] text-muted-foreground uppercase block font-bold">Height</span>
                          <span className="text-[11px] font-mono font-medium text-foreground">{Math.round(correctedBbox.height)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsBboxModalOpen(true)}
                      className="w-full h-11 rounded-xl border-dashed border-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      Click to Draw Corrected Nodule Box
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* ── Clinical notes ── */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-muted-foreground
                                 font-bold tracking-wider">
                Clinical notes (optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="What did the AI miss? Any additional context..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border
                           bg-background/50 text-sm text-foreground
                           placeholder:text-muted-foreground
                           focus:outline-none focus:ring-2
                           focus:ring-primary/20 focus:border-primary/40
                           resize-none transition-all"
              />
            </div>

          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div
            className={`flex items-center gap-2 ${feedbackFormClasses.error.container}
                        ${feedbackFormClasses.error.text} p-3 rounded-xl border`}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || isCorrect === null}
          className={`w-full h-11 rounded-xl font-bold text-sm transition-all ${
            isCorrect === null
              ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
          }`}
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2
                               border-primary-foreground/30 border-t-primary-foreground" />
              Saving…
            </span>
          ) : (
            "Submit review"
          )}
        </Button>

      </div>

      {/* ── BBox Drawing Modal ── */}
      <BBoxCorrectionDialog
        isOpen={isBboxModalOpen}
        onClose={() => setIsBboxModalOpen(false)}
        imageUrl={imageUrl}
        aiBbox={aiBbox}
        initialBbox={correctedBbox}
        onSave={(newBbox) => {
          setCorrectedBbox(newBbox);
          setBboxCorrect(false);
        }}
      />
    </div>
  );
} 