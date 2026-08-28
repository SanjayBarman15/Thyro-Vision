// frontend/components/dashboard/patient-card.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Copy,
  Check,
  Eye,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  Activity,
} from "lucide-react";
import { Patient } from "@/store/useStore";

// ─── Helpers ─────────────────────────────────────────────────

function getTiradsColorClass(tirads: number | null | undefined) {
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

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="opacity-40 hover:opacity-100 transition-opacity"
      title="Copy report ID"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-400" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// ─── Component ───────────────────────────────────────────────

interface PatientCardProps {
  patient: Patient;
}

export default function PatientCard({ patient }: PatientCardProps) {
  const followupDays = daysUntil(patient.nextFollowupDate);
  const isOverdue = patient.isOverdue;
  const hasFollowup = patient.nextFollowupDate !== null && patient.nextFollowupDate !== undefined;

  // Navigate to patient detail page (not analysis page directly)
  const patientHref = `/dashboard/patients/${patient.id}`;

  // Direct analysis link — goes to the latest analysis
  const analysisHref = `/dashboard/analysis/${patient.id}`;

  return (
    <Card
      className={`border-border bg-card hover:border-primary/30 transition-all duration-200 overflow-hidden ${
        isOverdue ? "border-red-500/30" : ""
      }`}
    >
      <div className="p-4 space-y-3">
        {/* ── Header ──────────────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={patientHref} className="hover:underline underline-offset-2">
                <h3 className="font-semibold text-foreground truncate">
                  {patient.firstName} {patient.lastName}
                </h3>
              </Link>
              {isOverdue && (
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {patient.age ? `${patient.age}y` : "—"} · {patient.gender ?? "—"}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-2.5 w-2.5" />
                {patient.totalScans ?? 0} scan{(patient.totalScans ?? 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* TI-RADS badge */}
          {patient.tiradsNum && (
            <Badge
              variant="outline"
              className={`shrink-0 text-xs font-bold ${getTiradsColorClass(patient.tiradsNum)}`}
            >
              TR{patient.tiradsNum}
            </Badge>
          )}
        </div>

        {/* ── Report ID ───────────────────────────── */}
        {patient.reportId && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
              {patient.reportId}
            </span>
            <CopyButton text={patient.reportId} />
          </div>
        )}

        {/* ── Scan date + follow-up ───────────────── */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2.5 mt-1">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(patient.lastScan)}
          </span>

          {hasFollowup && (
            <span
              className={`flex items-center gap-1 font-medium ${
                isOverdue
                  ? "text-red-400"
                  : followupDays !== null && followupDays <= 30
                  ? "text-orange-400"
                  : "text-muted-foreground"
              }`}
            >
              <Clock className="h-3 w-3" />
              {isOverdue
                ? `Overdue ${Math.abs(followupDays!)}d`
                : followupDays !== null
                ? `Due in ${followupDays}d`
                : ""}
            </span>
          )}
        </div>

        {/* ── Actions ─────────────────────────────── */}
        <div className="flex items-center gap-2 pt-0.5">
          <Link href={patientHref} className="flex-1">
            <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
              <User className="h-3 w-3" />
              Patient Profile
            </Button>
          </Link>
          <Link href={analysisHref}>
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs gap-1">
              <Eye className="h-3 w-3" />
              Analysis
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}