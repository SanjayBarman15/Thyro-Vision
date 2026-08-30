// frontend/components/analysis/reasoning-theater.tsx
"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThinkingStep {
  step: number;
  total: number;
  label: string;
  done: boolean;
}

interface ReasoningTheaterProps {
  steps: Map<number, ThinkingStep>;  // step_number → step data
  totalSteps: number;
  className?: string;
}

const STEP_ICONS = ["🧬", "📖", "⚙️", "🔬", "💡"];

export default function ReasoningTheater({ steps, totalSteps, className }: ReasoningTheaterProps) {
  const stepsArray = Array.from(steps.values()).sort((a, b) => a.step - b.step);

  if (stepsArray.length === 0) return null;

  const allDone = stepsArray.every(s => s.done) && stepsArray.length === totalSteps;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-xl border border-primary/20 bg-primary/5 overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 bg-primary/10">
        <div className="flex items-center gap-2">
          {allDone ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center"
            >
              <Check className="w-2 h-2 text-white" />
            </motion.div>
          ) : (
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            {allDone ? "Analysis Complete" : "Clinera Reasoning…"}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground font-mono">
          {stepsArray.filter(s => s.done).length}/{totalSteps}
        </span>
      </div>

      {/* Steps */}
      <div className="px-3 py-2.5 space-y-2">
        <AnimatePresence mode="popLayout">
          {stepsArray.map((step) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="flex items-center gap-2.5"
            >
              {/* Status indicator */}
              <div className="relative w-4 h-4 flex-shrink-0">
                {step.done ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="w-4 h-4 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center"
                  >
                    <Check className="w-2.5 h-2.5 text-green-400" />
                  </motion.div>
                ) : (
                  <div className="w-4 h-4 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-2 h-2 rounded-full border border-primary border-t-transparent"
                    />
                  </div>
                )}
              </div>

              {/* Step text */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-sm leading-none flex-shrink-0">
                  {STEP_ICONS[(step.step - 1) % STEP_ICONS.length]}
                </span>
                <span className={cn(
                  "text-[11px] leading-snug truncate transition-colors duration-300",
                  step.done
                    ? "text-foreground/60 line-through decoration-foreground/20"
                    : "text-foreground/90 font-medium"
                )}>
                  {step.label}
                </span>
              </div>

              {/* Timing badge */}
              {step.done && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-[9px] text-green-400 font-mono flex-shrink-0"
                >
                  ✓
                </motion.span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom progress bar */}
      {!allDone && (
        <div className="h-0.5 bg-primary/10 mx-3 mb-2 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary/40 rounded-full"
            initial={{ width: "0%" }}
            animate={{
              width: `${(stepsArray.filter(s => s.done).length / Math.max(totalSteps, 1)) * 100}%`
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      )}
    </motion.div>
  );
}
