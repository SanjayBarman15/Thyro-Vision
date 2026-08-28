// app/followups/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Calendar, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────
interface FollowupPatient {
  id:                  string;
  firstName:           string;
  lastName:            string;
  age:                 number;
  gender:              string;
  nextFollowupDate:    string;
  followupNotes:       string | null;
  totalScans:          number;
  latestTirads:        number | null;
  latestReportId:      string | null;
  latestPredictionId:  string | null;
  daysUntilDue:        number;
  isOverdue:           boolean;
}

// ── Helpers ────────────────────────────────────────────────
const TIRADS_COLOR: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-green-100 text-green-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100 text-red-800",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function urgencyLabel(days: number, isOverdue: boolean): {
  label: string; color: string; bg: string;
} {
  if (isOverdue) return {
    label: `Overdue by ${Math.abs(days)}d`,
    color: "text-red-700", bg: "bg-red-50 border-red-200",
  };
  if (days <= 7)  return { label: `Due in ${days}d`, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" };
  if (days <= 30) return { label: `Due in ${days}d`, color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" };
  return { label: `Due in ${days}d`, color: "text-muted-foreground", bg: "bg-muted/40 border-border" };
}

// ── Patient row ────────────────────────────────────────────
function FollowupRow({ patient }: { patient: FollowupPatient }) {
  const urgency = urgencyLabel(patient.daysUntilDue, patient.isOverdue);

  return (
    <div className={cn(
      "flex items-center gap-4 px-5 py-4 border rounded-lg transition-colors hover:bg-muted/30",
      urgency.bg,
    )}>
      {/* Left: urgency icon */}
      <div className="shrink-0">
        {patient.isOverdue
          ? <AlertTriangle className="h-5 w-5 text-red-500" />
          : <Clock className="h-5 w-5 text-muted-foreground" />
        }
      </div>

      {/* Patient info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {patient.firstName} {patient.lastName}
          </span>
          {patient.latestTirads && (
            <Badge className={cn("text-[11px] font-semibold px-2 py-0", TIRADS_COLOR[patient.latestTirads])}>
              TR{patient.latestTirads}
            </Badge>
          )}
          {patient.isOverdue && (
            <Badge variant="destructive" className="text-[11px] px-2 py-0">Overdue</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span>{patient.age}y · {patient.gender}</span>
          {patient.latestReportId && (
            <span className="font-mono">{patient.latestReportId}</span>
          )}
          <span>{patient.totalScans} scan{patient.totalScans !== 1 ? "s" : ""}</span>
        </div>
        {patient.followupNotes && (
          <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">
            {patient.followupNotes}
          </p>
        )}
      </div>

      {/* Due date */}
      <div className="text-right shrink-0">
        <p className={cn("text-sm font-medium", urgency.color)}>
          {urgency.label}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
          <Calendar className="h-3 w-3" />
          {formatDate(patient.nextFollowupDate)}
        </p>
      </div>

      {/* View button */}
      <Link href={`/dashboard/patients/${patient.id}`}>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border rounded-lg bg-muted/10">
      <Skeleton className="h-5 w-5 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-60" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-8 w-8 rounded-md" />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────
type Filter = "all" | "overdue" | "upcoming";

export default function FollowupsPage() {
  const supabase = createClient();

  const [filter, setFilter]     = useState<Filter>("all");
  const [patients, setPatients] = useState<FollowupPatient[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchFollowups = useCallback(async (f: Filter) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_followup_patients", {
        p_filter: f,
        p_limit:  100,
        p_offset: 0,
      });
      if (error) throw error;
      const formatted: FollowupPatient[] = (data || []).map((r: any) => ({
        id:                 r.id,
        firstName:          r.first_name,
        lastName:           r.last_name,
        age:                r.age,
        gender:             r.gender,
        nextFollowupDate:   r.next_followup_date,
        followupNotes:      r.followup_notes,
        totalScans:         r.total_scans,
        latestTirads:       r.latest_tirads,
        latestReportId:     r.latest_report_id,
        latestPredictionId: r.latest_prediction_id,
        daysUntilDue:       r.days_until_due,
        isOverdue:          r.is_overdue,
      }));
      setPatients(formatted);
    } catch (err) {
      console.error("Error fetching follow-ups:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowups(filter);
  }, [filter, fetchFollowups]);

  const overdue  = patients.filter(p => p.isOverdue);
  const upcoming = patients.filter(p => !p.isOverdue);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "overdue",  label: `Overdue (${overdue.length})` },
    { key: "upcoming", label: "Upcoming" },
  ];

  return (
    <>
      {/* Header */}
      <header className="flex h-16 items-center gap-3 px-6 border-b border-border/50 shrink-0">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm">Follow-ups</span>
        {overdue.length > 0 && (
          <Badge variant="destructive" className="text-[11px] ml-1">
            {overdue.length} overdue
          </Badge>
        )}
      </header>

      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total due", value: patients.length, color: "text-foreground" },
            { label: "Overdue", value: overdue.length, color: overdue.length > 0 ? "text-red-600" : "text-foreground" },
            { label: "Upcoming", value: upcoming.length, color: "text-foreground" },
          ].map((stat) => (
            <div key={stat.label} className="bg-muted/40 rounded-lg p-4 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`text-2xl font-medium ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No follow-ups</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {filter === "overdue" ? "No overdue patients." : "No patients with scheduled follow-ups."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Overdue section */}
            {filter !== "upcoming" && overdue.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600 px-1">
                  Overdue — {overdue.length}
                </p>
                {overdue.map((p) => (
                  <FollowupRow key={p.id} patient={p} />
                ))}
              </div>
            )}

            {/* Upcoming section */}
            {filter !== "overdue" && upcoming.length > 0 && (
              <div className="space-y-2">
                {filter === "all" && overdue.length > 0 && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2">
                    Upcoming — {upcoming.length}
                  </p>
                )}
                {upcoming.map((p) => (
                  <FollowupRow key={p.id} patient={p} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}