"use client";

import React from "react";
import { FlaskConical, ArrowRight, Minus, Plus, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SimulationBlockProps {
  originalTr: number;
  simulatedTr: number;
  originalPoints: number;
  simulatedPoints: number;
  modifications: Record<string, any>;
  guideline?: string;
}

export default function SimulationBlock({
  originalTr,
  simulatedTr,
  originalPoints,
  simulatedPoints,
  modifications,
  guideline = "ACR 2017"
}: SimulationBlockProps) {
  const isUpgraded = simulatedTr > originalTr;
  const isDowngraded = simulatedTr < originalTr;
  const pointsDelta = simulatedPoints - originalPoints;

  return (
    <div className="my-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 overflow-hidden">
      <div className="bg-primary/10 px-3 py-1.5 flex items-center justify-between border-b border-primary/20">
        <div className="flex items-center gap-2 text-primary">
          <FlaskConical className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Hypothetical Simulation</span>
        </div>
        <Badge variant="outline" className="text-[9px] bg-background/50 border-primary/30 text-primary">
          {guideline} Grounded
        </Badge>
      </div>

      <div className="p-4 space-y-4">
        {/* Tier Changes */}
        <div className="flex items-center justify-center gap-6 py-2">
          <div className="text-center">
            <p className="text-[9px] text-muted-foreground uppercase font-bold mb-1">Original</p>
            <div className="text-xl font-black text-muted-foreground/60">TR{originalTr}</div>
            <p className="text-[10px] text-muted-foreground">{originalPoints} pts</p>
          </div>
          
          <ArrowRight className="w-5 h-5 text-primary/40" />

          <div className="text-center">
            <p className="text-[9px] text-primary uppercase font-bold mb-1">Simulated</p>
            <div className={cn(
               "text-2xl font-black",
               isUpgraded ? "text-destructive" : isDowngraded ? "text-green-500" : "text-primary"
            )}>
              TR{simulatedTr}
            </div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-[10px] font-mono font-bold">
                {simulatedPoints} pts
              </span>
              {pointsDelta !== 0 && (
                <Badge className={cn(
                  "h-4 px-1 text-[9px]",
                  pointsDelta > 0 ? "bg-destructive" : "bg-green-500"
                )}>
                  {pointsDelta > 0 ? "+" : ""}{pointsDelta}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Change Detail */}
        <div className="bg-background/80 rounded-lg p-3 border border-primary/10">
           <h5 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Simulated Modification:</h5>
           {Object.entries(modifications).map(([key, data]: [string, any]) => (
             <div key={key} className="flex items-center justify-between text-xs">
                <span className="capitalize text-muted-foreground">{key}:</span>
                <span className="font-bold text-primary">{data.value}</span>
             </div>
           ))}
        </div>

        {/* Warning Badge */}
        <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded-md border border-yellow-500/20">
           <AlertTriangle className="w-3 h-3 text-yellow-600 shrink-0 mt-0.5" />
           <p className="text-[9px] leading-tight text-yellow-700 italic">
             This analysis is hypothetical and used for clinical simulation only. It has **not** been applied to the official patient record.
           </p>
        </div>
      </div>
    </div>
  );
}
