// frontend/components/analysis/feature-sim-panel.tsx
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ACR TI-RADS feature options (mirrors backend FEATURE_DEFINITIONS)
const FEATURE_OPTIONS = {
  composition: {
    label: "Composition",
    emoji: "🫧",
    options: [
      { value: "cystic", label: "Cystic / Completely cystic", pts: 0 },
      { value: "spongiform", label: "Spongiform (>50% cystic)", pts: 0 },
      { value: "mixed_cystic_solid", label: "Mixed cystic and solid", pts: 1 },
      { value: "solid", label: "Solid or almost completely solid", pts: 2 },
    ],
  },
  echogenicity: {
    label: "Echogenicity",
    emoji: "📡",
    options: [
      { value: "anechoic", label: "Anechoic", pts: 0 },
      { value: "hyperechoic", label: "Hyper- or isoechoic", pts: 1 },
      { value: "hypoechoic", label: "Hypoechoic", pts: 2 },
      { value: "very_hypoechoic", label: "Very hypoechoic", pts: 3 },
    ],
  },
  shape: {
    label: "Shape",
    emoji: "📐",
    options: [
      { value: "wider_than_tall", label: "Wider than tall", pts: 0 },
      { value: "taller_than_wide", label: "Taller than wide", pts: 3 },
    ],
  },
  margin: {
    label: "Margin",
    emoji: "🔲",
    options: [
      { value: "smooth", label: "Smooth", pts: 0 },
      { value: "ill_defined", label: "Ill-defined", pts: 0 },
      { value: "lobulated", label: "Lobulated or irregular", pts: 2 },
      { value: "irregular", label: "Irregular", pts: 2 },
      { value: "extrathyroidal_extension", label: "Extra-thyroidal extension", pts: 3 },
    ],
  },
  echogenic_foci: {
    label: "Echogenic Foci",
    emoji: "✨",
    options: [
      { value: "none", label: "None", pts: 0 },
      { value: "macrocalcifications", label: "Macrocalcifications", pts: 1 },
      { value: "peripheral", label: "Peripheral / Rim calcifications", pts: 2 },
      { value: "punctate_echogenic_foci", label: "Punctate echogenic foci", pts: 3 },
      { value: "microcalcifications", label: "Microcalcifications", pts: 3 },
    ],
  },
};

type FeatureKey = keyof typeof FEATURE_OPTIONS;
type FeaturesState = Partial<Record<FeatureKey, string>>;

interface FeatureSimPanelProps {
  /** Pre-fill with current scan's feature values */
  prefillFeatures?: FeaturesState;
  /** Called when doctor clicks "Analyse" */
  onRunSimulation: (features: FeaturesState, message: string) => void;
  isLoading?: boolean;
  className?: string;
}

function computePoints(features: FeaturesState): { total: number; tirads: number } {
  let total = 0;
  for (const [feat, value] of Object.entries(features)) {
    const opts = FEATURE_OPTIONS[feat as FeatureKey]?.options ?? [];
    const opt = opts.find((o) => o.value === value);
    if (opt) total += opt.pts;

    // TR1 auto-override
    if (feat === "composition" && (value === "cystic" || value === "spongiform")) {
      return { total: 0, tirads: 1 };
    }
  }

  let tirads = 1;
  if (total === 0) tirads = 1;
  else if (total === 2) tirads = 2;
  else if (total === 3) tirads = 3;
  else if (total >= 4 && total <= 6) tirads = 4;
  else if (total >= 7) tirads = 5;
  return { total, tirads };
}

const TR_COLORS: Record<number, string> = {
  1: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
  2: "text-green-400 border-green-500/30 bg-green-500/5",
  3: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
  4: "text-orange-400 border-orange-500/30 bg-orange-500/5",
  5: "text-red-400 border-red-500/30 bg-red-500/5",
};

export default function FeatureSimPanel({
  prefillFeatures = {},
  onRunSimulation,
  isLoading = false,
  className,
}: FeatureSimPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [features, setFeatures] = useState<FeaturesState>({ ...prefillFeatures });

  const allSelected = Object.keys(FEATURE_OPTIONS).every((k) => features[k as FeatureKey]);
  const { total, tirads } = computePoints(features);
  const hasAnySelected = Object.keys(features).length > 0;

  const handleRun = () => {
    if (!allSelected) return;
    const featureNames = Object.keys(FEATURE_OPTIONS).map((k) => {
      const feat = FEATURE_OPTIONS[k as FeatureKey];
      const opt = feat.options.find((o) => o.value === features[k as FeatureKey]);
      return `${feat.label}: ${opt?.label ?? "?"}`;
    }).join(", ");
    const message = `Run a simulation with these features: ${featureNames}. What TI-RADS category does this yield and what is the clinical analysis?`;
    onRunSimulation(features, message);
  };

  return (
    <div className={cn("rounded-xl border border-border/60 bg-muted/20 overflow-hidden", className)}>
      {/* Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Feature Simulator
          </span>
          {hasAnySelected && (
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono",
              TR_COLORS[tirads] ?? TR_COLORS[1]
            )}>
              TR{tirads} · {total}pts
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Panel Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-border/40 pt-2.5">
              {/* Feature selectors */}
              {Object.entries(FEATURE_OPTIONS).map(([key, config]) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <span>{config.emoji}</span>
                    {config.label}
                    {features[key as FeatureKey] && (
                      <span className="ml-auto text-[9px] text-primary font-mono">
                        +{config.options.find((o) => o.value === features[key as FeatureKey])?.pts ?? 0}pts
                      </span>
                    )}
                  </label>
                  <Select
                    value={features[key as FeatureKey] ?? ""}
                    onValueChange={(val) =>
                      setFeatures((prev) => ({ ...prev, [key]: val }))
                    }
                  >
                    <SelectTrigger className="h-8 text-[11px] bg-background/50 border-border/50">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {config.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-[11px]">
                          <span className="flex items-center justify-between gap-3 w-full">
                            <span>{opt.label}</span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {opt.pts}pt{opt.pts !== 1 ? "s" : ""}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Live score preview */}
              {hasAnySelected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border",
                    TR_COLORS[tirads] ?? TR_COLORS[1]
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider">
                    Predicted Classification
                  </span>
                  <span className="text-sm font-black font-mono">
                    TR{tirads} · {total} pts
                  </span>
                </motion.div>
              )}

              {/* Run button */}
              <Button
                size="sm"
                className="w-full h-8 text-[11px] gap-2"
                onClick={handleRun}
                disabled={!allSelected || isLoading}
              >
                <Zap className="w-3 h-3" />
                {isLoading ? "Analysing…" : "Run Clinical Analysis"}
              </Button>

              {!allSelected && (
                <p className="text-[9px] text-muted-foreground text-center">
                  Select all 5 features to run analysis
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
