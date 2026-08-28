// frontend/app/dashboard/(main)/patients/[id]/page.tsx
"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  AlertTriangle,
  Plus,
  FileText,
  Eye,
  Copy,
  Check,
  User,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { tiradsColors } from "@/lib/colors";
import { useStore, Patient, PatientScan } from "@/store/useStore";
import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────

const TIRADS_LABEL: Record<number, string> = {
  1: "TR1", 2: "TR2", 3: "TR3", 4: "TR4", 5: "TR5",
};

const TIRADS_RISK: Record<number, string> = {
  1: "Benign", 2: "Not Suspicious", 3: "Mildly Suspicious",
  4: "Moderately Suspicious", 5: "Highly Suspicious",
};

const TIRADS_COLOR: Record<number, string> = {
  1: tiradsColors.tr1,
  2: tiradsColors.tr2,
  3: tiradsColors.tr3,
  4: tiradsColors.tr4,
  5: tiradsColors.tr5,
};

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

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Sub-components ──────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
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

function FollowUpBadge({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date);
  if (days === null) return null;

  if (days < 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        Follow-up overdue by {Math.abs(days)}d
      </div>
    );
  }
  if (days <= 30) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-medium">
        <Clock className="h-3.5 w-3.5" />
        Follow-up in {days}d — {formatDate(date!)}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 border border-border text-muted-foreground text-xs font-medium">
      <Calendar className="h-3.5 w-3.5" />
      Follow-up: {formatDate(date!)}
    </div>
  );
}

function TrendIcon({ scans }: { scans: PatientScan[] }) {
  const withTirads = scans.filter((s) => s.tirads !== null);
  if (withTirads.length < 2) return null;
  const latest = withTirads[0].tirads!;
  const previous = withTirads[1].tirads!;
  if (latest > previous)
    return <TrendingUp className="h-4 w-4 text-red-400" />;
  if (latest < previous)
    return <TrendingDown className="h-4 w-4 text-green-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

// ─── TI-RADS Trend Chart ─────────────────────────────────────

function TiradsTrendChart({ scans }: { scans: PatientScan[] }) {
  const data = scans
    .filter((s) => s.tirads !== null)
    .reverse()
    .map((s) => ({
      date: new Date(s.uploadedAt).toLocaleDateString("en-US", {
        month: "short", year: "2-digit",
      }),
      tirads: s.tirads,
      label: `TR${s.tirads}`,
      reportId: s.reportId,
    }));

  if (data.length < 2) {
    return (
      <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
        Need at least 2 scans to show trend
      </div>
    );
  }

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = TIRADS_COLOR[payload.tirads as number] ?? "#888";
    return (
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--background)" strokeWidth={2} />
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-foreground">{d.label}</p>
        <p className="text-muted-foreground">{d.date}</p>
        {d.reportId && (
          <p className="text-muted-foreground font-mono mt-1">{d.reportId}</p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[1, 5]}
          ticks={[1, 2, 3, 4, 5]}
          tickFormatter={(v) => `TR${v}`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={4} stroke="var(--destructive)" strokeDasharray="4 4" opacity={0.4} />
        <Line
          type="monotone"
          dataKey="tirads"
          stroke="var(--primary)"
          strokeWidth={2}
          dot={<CustomDot />}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Scan Row ─────────────────────────────────────────────────

function ScanRow({
  scan,
  index,
  isLatest,
  patientId,
  latestPredictionId,
}: {
  scan: PatientScan;
  index: number;
  isLatest: boolean;
  patientId: string;
  latestPredictionId: string | null;
}) {
  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors hover:bg-muted/30 ${
        isLatest ? "border-primary/20 bg-primary/5" : "border-border bg-card"
      }`}
    >
      {/* Date + index */}
      <div className="w-24 shrink-0">
        <p className="text-xs font-medium text-foreground">
          {formatDate(scan.uploadedAt)}
        </p>
        <p className="text-[10px] text-muted-foreground">Scan #{index + 1}</p>
      </div>

      {/* TI-RADS badge */}
      <div className="w-20 shrink-0">
        {scan.tirads ? (
          <Badge
            variant="outline"
            className={`text-xs font-semibold ${getTiradsColorClass(scan.tirads)}`}
          >
            {TIRADS_LABEL[scan.tirads]}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            No result
          </Badge>
        )}
      </div>

      {/* Risk label */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <p className="text-xs text-muted-foreground truncate">
          {scan.tirads ? TIRADS_RISK[scan.tirads] : "—"}
        </p>
      </div>

      {/* Confidence */}
      <div className="w-16 shrink-0 hidden md:block">
        {scan.confidence !== null ? (
          <p className="text-xs font-mono text-muted-foreground">
            {Math.round(scan.confidence * 100)}%
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">—</p>
        )}
      </div>

      {/* Report ID */}
      <div className="w-36 shrink-0 hidden lg:flex items-center">
        {scan.reportId ? (
          <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
            {scan.reportId}
            <CopyButton text={scan.reportId} />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Latest badge */}
      <div className="w-16 shrink-0 hidden sm:block">
        {isLatest && (
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
            Latest
          </Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {scan.predictionId ? (
          <div className="flex items-center gap-1.5">
            {!isLatest && latestPredictionId && (
              <Link href={`/dashboard/patients/${patientId}/compare?id_a=${scan.predictionId}&id_b=${latestPredictionId}`}>
                <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] gap-1 border-primary/30 text-primary hover:bg-primary/5">
                  <Activity className="h-3 w-3" />
                  Compare
                </Button>
              </Link>
            )}
            <Link href={`/dashboard/analysis/${scan.predictionId}`}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                <Eye className="h-3 w-3" />
                <span className="hidden sm:inline">View</span>
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const {
    selectedPatient: patient,
    selectedPatientScans: scans,
    selectedPatientReports: reports,
    fetchingDetail: loading,
    fetchPatientDetail,
  } = useStore();

  useEffect(() => {
    fetchPatientDetail(id);
  }, [id, fetchPatientDetail]);

  // ── Loading ──────────────────────────────────────────────
  if (loading && !patient) {
    return (
      <div className="flex-1 p-6 space-y-6 w-full">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────
  if (!patient && !loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Patient not found.</p>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  if (!patient) return null;

  const latestScan = scans[0] ?? null;
  const overdue = patient.isOverdue;

  // ── Stats ─────────────────────────────────────────────────
  const stats = [
    {
      label: "Total Scans",
      value: patient.totalScans,
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Latest TI-RADS",
      value: latestScan?.tirads ? `TR${latestScan.tirads}` : "—",
      icon: <FileText className="h-4 w-4" />,
      colorClass: getTiradsColorClass(latestScan?.tirads ?? null),
    },
    {
      label: "Patient Since",
      value: formatDate(patient.lastScan),
      icon: <User className="h-4 w-4" />,
    },
    {
      label: "Follow-up Status",
      value: patient.nextFollowupDate
        ? overdue
          ? "Overdue"
          : `In ${daysUntil(patient.nextFollowupDate)}d`
        : "None needed",
      icon: <Calendar className="h-4 w-4" />,
      colorClass: overdue
        ? "text-red-400"
        : patient.nextFollowupDate
        ? "text-orange-400"
        : "text-green-400",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full px-4 sm:px-6 py-6 space-y-6">

        {/* ── Back + Header ──────────────────────────────── */}
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                {patient.firstName} {patient.lastName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-sm text-muted-foreground">
                  {patient.age}y · {patient.gender}
                  {patient.dob ? ` · DOB ${formatDate(patient.dob)}` : ""}
                </span>
                <FollowUpBadge date={patient.nextFollowupDate} />
              </div>
            </div>

            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => {
                // Store patient context for auto-selection in NewScanPanel
                sessionStorage.setItem("preselectPatientId",   patient.id);
                sessionStorage.setItem("preselectPatientName", `${patient.firstName} ${patient.lastName}`);
                sessionStorage.setItem("preselectGender",      patient.gender);
                sessionStorage.setItem("preselectAge",         patient.age.toString());
                sessionStorage.setItem("preselectDob",         patient.dob || "");
                router.push("/dashboard");
              }}
            >
              <Plus className="h-4 w-4" />
              New Scan
            </Button>
          </div>
        </div>

        {/* ── Stats Strip ────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="p-4 border-border bg-card">
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                {s.icon}
                <span className="text-[10px] uppercase tracking-wider font-semibold">
                  {s.label}
                </span>
              </div>
              <p
                className={`text-lg font-bold text-foreground ${
                  s.colorClass ?? ""
                }`}
              >
                {s.value}
              </p>
            </Card>
          ))}
        </div>

        {/* ── TI-RADS Trend + Medical Notes ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trend chart — 2/3 width */}
          <Card className="lg:col-span-2 p-5 border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  TI-RADS Trend
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Classification history over time
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendIcon scans={scans} />
                {scans.filter((s) => s.tirads !== null).length} data points
              </div>
            </div>
            <TiradsTrendChart scans={scans} />
            {/* Legend */}
            <div className="flex items-center gap-1 mt-3">
              <div className="w-16 h-px border-t border-dashed border-destructive/50" />
              <span className="text-[10px] text-muted-foreground">
                TR4+ threshold
              </span>
            </div>
          </Card>

          {/* Medical notes + Report History — 1/3 width */}
          <div className="flex flex-col gap-4">
            <Card className="p-5 border-border bg-card flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-1">
                  Clinical Notes
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {patient.pastMedicalData ?? "No clinical notes recorded."}
                </p>
              </div>

              {patient.followupNotes && (
                <div className="border-t border-border pt-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Follow-up Notes
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {patient.followupNotes}
                  </p>
                </div>
              )}

              {latestScan?.reportId && (
                <div className="border-t border-border pt-3 mt-auto">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Latest Report ID
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-foreground bg-muted px-2 py-1 rounded">
                      {latestScan.reportId}
                    </span>
                    <CopyButton text={latestScan.reportId} />
                  </div>
                </div>
              )}
            </Card>

            {/* Report Download History */}
            <Card className="p-5 border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Report Downloads
                </h2>
              </div>
              
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No reports exported for this patient yet.
                  </p>
                ) : (
                  reports.map((report) => (
                    <div key={report.id} className="flex flex-col gap-1 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono text-foreground font-medium">
                          {report.reportId}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-muted-foreground/30 text-muted-foreground">
                          TR{report.tiradsAtExport}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatDate(report.exportedAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Scan History ────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Scan History
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {scans.length} scan{scans.length !== 1 ? "s" : ""}
              </span>
            </h2>
          </div>

          {scans.length === 0 ? (
            <Card className="p-8 border-border bg-card text-center">
              <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No scans yet for this patient.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "New Scan" to start the first analysis.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Table header */}
              <div className="flex items-center gap-4 px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="w-24 shrink-0">Date</div>
                <div className="w-20 shrink-0">TI-RADS</div>
                <div className="flex-1 hidden sm:block">Risk Level</div>
                <div className="w-16 shrink-0 hidden md:block">Confidence</div>
                <div className="w-36 shrink-0 hidden lg:block">Report ID</div>
                <div className="w-16 shrink-0 hidden sm:block" />
                <div className="shrink-0 w-16" />
              </div>

              {scans.map((scan, i) => (
                <ScanRow
                  key={scan.rawImageId}
                  scan={scan}
                  index={scans.length - 1 - i}
                  isLatest={i === 0}
                  patientId={patient.id}
                  latestPredictionId={scans[0]?.predictionId || null}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}