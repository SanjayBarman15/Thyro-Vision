// frontend/app/dashboard/(main)/patients/[id]/compare/page.tsx
"use client";

import { useEffect, use, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Activity,
  Calendar,
  Eye,
  FileText,
  AlertTriangle,
  Clock,
  ChevronRight,
  TrendingUp,
  Scan,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore, PatientScan } from "@/store/useStore";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getTiradsColorClass(tirads: number | null) {
  if (!tirads) return "bg-muted text-muted-foreground border-border";
  const map: Record<number, string> = {
    1: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    2: "bg-green-500/10 text-green-400 border-green-500/30",
    3: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    4: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    5: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return map[tirads] ?? "bg-muted text-muted-foreground border-border";
}

// ─── Sub-components ──────────────────────────────────────────

function NoduleOverlay({ bbox }: { bbox: any }) {
    if (!bbox || typeof bbox !== 'object') return null;

    const { x, y, width, height, image_width, image_height } = bbox;
    if (x === undefined || y === undefined || !image_width || !image_height) return null;

    // Convert to percentages for responsive scaling
    const left = (x / image_width) * 100;
    const top = (y / image_height) * 100;
    const w = (width / image_width) * 100;
    const h = (height / image_height) * 100;

    return (
        <div 
            className="absolute z-10 pointer-events-none group"
            style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${w}%`,
                height: `${h}%`,
            }}
        >
            {/* Main BBox - Dashed and animated */}
            <div className="absolute inset-0 border-2 border-primary border-dashed rounded-sm shadow-[0_0_15px_rgba(var(--primary),0.3)] animate-pulse" />
            
            {/* Corner pieces for a "targeting" look */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary" />
            <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary" />

            {/* Label */}
            <div className="absolute -top-6 left-0 bg-primary/90 text-primary-foreground text-[8px] font-bold px-1.5 py-0.5 rounded leading-none uppercase tracking-tighter">
                Nodule Detection
            </div>
        </div>
    );
}

function ScanPanel({ 
    scan, 
    title, 
    showInsights 
}: { 
    scan: PatientScan | undefined, 
    title: string, 
    showInsights: boolean 
}) {
  const { signedUrl: rawUrl } = useSignedUrl(scan?.fileUrl || null);
  const { signedUrl: procUrl } = useSignedUrl(scan?.processedUrl || null);
  const displayUrl = procUrl || rawUrl;

  if (!scan) return (
    <Card className="flex-1 p-8 border-dashed border-2 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
      <p>Scan data not found.</p>
    </Card>
  );

  return (
    <div className="flex-1 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <Badge variant="outline" className="text-[10px]">{formatDate(scan.uploadedAt)}</Badge>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        {/* Image Display */}
        <div className="aspect-square bg-black relative flex items-center justify-center overflow-hidden rounded-lg group/scan">
             {displayUrl ? (
                <div 
                    className="relative max-w-full max-h-full shadow-2xl"
                    style={{ 
                        aspectRatio: (scan.boundingBox?.image_width && scan.boundingBox?.image_height) 
                            ? `${scan.boundingBox.image_width} / ${scan.boundingBox.image_height}` 
                            : 'auto' 
                    }}
                >
                    <img 
                        src={displayUrl || undefined} 
                        alt={title} 
                        className="w-full h-full object-cover rounded-sm"
                    />
                    {showInsights && <NoduleOverlay bbox={scan.boundingBox} />}
                    
                    {/* Hover indicator for ROI */}
                    <div className="absolute inset-0 border border-white/5 opacity-0 group-hover/scan:opacity-100 transition-opacity pointer-events-none" />
                </div>
            ) : (
                <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <Eye className="h-8 w-8 opacity-20" />
                    <span className="text-xs">No image available</span>
                </div>
            )}
            
            {/* TI-RADS Overlay */}
            <div className="absolute bottom-3 right-3">
                <Badge className={`text-sm font-bold shadow-lg ${getTiradsColorClass(scan.tirads)}`}>
                    TR{scan.tirads ?? "?"}
                </Badge>
            </div>
        </div>

        {/* Info List */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Classification</p>
              <p className="text-sm font-medium">TI-RADS {scan.tirads}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Confidence</p>
              <p className="text-sm font-medium">{scan.confidence ? `${Math.round(scan.confidence * 100)}%` : "—"}</p>
            </div>
          </div>
          
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">Clinical Findings</p>
            <div className="flex flex-wrap gap-1.5">
              {/* Flattened Logic */}
              {(() => {
                const feats = scan.features || {};
                const badges: React.ReactNode[] = [];

                // 1. Total Points (Priority)
                if (feats.total_points !== undefined) {
                  badges.push(
                    <Badge key="pts" variant="secondary" className="text-[10px] py-0 h-5 px-2 bg-primary/20 text-primary border-primary/20 font-bold">
                      Points: {feats.total_points}
                    </Badge>
                  );
                }

                // 2. Clinical Features (Flattened)
                if (feats.clinical_features) {
                  Object.entries(feats.clinical_features).forEach(([key, f]: [string, any]) => {
                    const label = key.replace('_', ' ');
                    const val = typeof f === 'object' ? f.description || f.value : f;
                    if (val) {
                      badges.push(
                        <Badge key={key} variant="outline" className="text-[10px] py-0 h-5 px-2 bg-muted/30 font-normal">
                          <span className="opacity-50 mr-1 capitalize">{label}:</span>
                          {val}
                        </Badge>
                      );
                    }
                  });
                }

                // 3. Measurements
                if (feats.measurements) {
                    Object.entries(feats.measurements).forEach(([key, val]: [string, any]) => {
                        const label = key.replace('nodule_', '').replace('_relative', ' %');
                        badges.push(
                            <Badge key={key} variant="secondary" className="text-[10px] py-0 h-5 px-2 bg-muted/50 font-normal">
                                <span className="opacity-50 mr-1 capitalize">{label}:</span>
                                {typeof val === 'number' ? `${(val * 100).toFixed(1)}%` : val}
                            </Badge>
                        );
                    });
                }

                return badges.length > 0 ? badges : (
                  <span className="text-[10px] text-muted-foreground italic">No feature data available</span>
                );
              })()}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function ComparisonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = use(params);
  const searchParams = useSearchParams();
  const idA = searchParams.get("id_a");
  const idB = searchParams.get("id_b");
  
  const {
    selectedPatient: patient,
    selectedPatientScans: scans,
    fetchingComparison: loadingSummary,
    comparisonSummary,
    fetchPatientDetail,
    fetchComparison,
  } = useStore();

  const [showAIInsights, setShowAIInsights] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!patient) {
      fetchPatientDetail(patientId);
    }
  }, [patientId, fetchPatientDetail, patient]);

  useEffect(() => {
    if (patientId && idA && idB) {
      fetchComparison(patientId, idA, idB);
    }
  }, [patientId, idA, idB, fetchComparison]);

  const scanA = scans.find(s => s.predictionId === idA);
  const scanB = scans.find(s => s.predictionId === idB);

  if (!idA || !idB) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <AlertTriangle className="h-10 w-10 text-orange-400 mx-auto" />
          <h2 className="text-lg font-semibold">Missing selection</h2>
          <p className="text-sm text-muted-foreground">Please select two scans from the patient history to compare them.</p>
          <Button variant="outline" onClick={() => router.back()}>Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-4 sm:px-6 py-6 space-y-8">
        
        {/* ── Header ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
              <ChevronRight className="h-3 w-3" />
              <Link href={`/dashboard/patients/${patientId}`} className="hover:text-foreground">Patient Profile</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground">Scan Comparison</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">AI Scan Comparison</h1>
                    <p className="text-sm text-muted-foreground">
                        {patient?.firstName} {patient?.lastName} · {patient?.age}y · {patient?.gender}
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
                    <Switch 
                        id="ai-insights" 
                        checked={showAIInsights} 
                        onCheckedChange={setShowAIInsights} 
                    />
                    <Label htmlFor="ai-insights" className="text-[10px] font-bold uppercase tracking-wider cursor-pointer">
                        AI Markings
                    </Label>
                </div>
                
                <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary gap-1 px-3 py-1">
                    <TrendingUp className="h-3 w-3" />
                    Longitudinal Analysis
                </Badge>
            </div>
          </div>
        </div>

        {/* ── AI Delta Analysis Banner ──────────────────────── */}
        <Card className="relative overflow-hidden border-primary/20 bg-primary/5 rounded-2xl shadow-sm">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <FileText className="h-24 w-24" />
            </div>
            
            <div className="p-6 sm:p-8 relative">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
                        <Activity className="h-4 w-4" />
                    </div>
                    <h2 className="text-lg font-bold">AI Delta Analysis</h2>
                    {loadingSummary && <Badge variant="secondary" className="animate-pulse">Generating...</Badge>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3">
                        {loadingSummary ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-[90%]" />
                                <Skeleton className="h-4 w-[95%]" />
                            </div>
                        ) : comparisonSummary ? (
                            <div className="prose prose-sm prose-invert max-w-none text-foreground/90 leading-relaxed">
                                <ReactMarkdown
                                    components={{
                                        strong: ({...props}) => <span className="font-bold text-primary" {...props} />,
                                        ul: ({...props}) => <ul className="list-disc pl-4 space-y-1 mb-4" {...props} />,
                                        li: ({...props}) => <li className="mb-1" {...props} />,
                                        p: ({...props}) => <p className="mb-3" {...props} />,
                                    }}
                                >
                                    {comparisonSummary}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">Unable to generate comparison summary.</p>
                        )}
                    </div>
                    
                    <div className="flex flex-col gap-4">
                        <div className="p-4 rounded-xl bg-background/50 border border-border">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">TI-RADS DELTA</p>
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className={getTiradsColorClass(scanA?.tirads ?? null)}>TR{scanA?.tirads ?? '?'}</Badge>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                <Badge variant="outline" className={cn(getTiradsColorClass(scanB?.tirads ?? null), "px-3 py-1 text-sm")}>TR{scanB?.tirads ?? '?'}</Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>

        {/* ── Side-by-Side Comparison ────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <ScanPanel scan={scanA} title="Baseline Scan" showInsights={showAIInsights} />
            <ScanPanel scan={scanB} title="Follow-up Scan" showInsights={showAIInsights} />
        </div>

        {/* ── Legend/Footer ──────────────────────────────────── */}
        <div className="flex items-center justify-center pt-8 text-[11px] text-muted-foreground gap-8">
            <div className="flex items-center gap-1.5 italic">
                <Clock className="h-3 w-3" />
                Time between scans: {scanA && scanB ? 
                    `${Math.round((new Date(scanB.uploadedAt).getTime() - new Date(scanA.uploadedAt).getTime()) / (1000 * 60 * 60 * 24))} days` 
                    : "—"}
            </div>
            <div className="flex items-center gap-1.5 opacity-60">
                <AlertTriangle className="h-3 w-3" />
                For clinical reference only
            </div>
        </div>
      </div>
    </div>
  );
}
