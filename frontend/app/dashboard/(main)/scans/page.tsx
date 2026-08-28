"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ScanLine,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileDown,
  Copy,
  Check,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────
interface Scan {
  rawImageId:    string;
  predictionId:  string;
  reportId:      string | null;
  patientId:     string;
  patientName:   string;
  age:           number;
  gender:        string;
  uploadedAt:    string;
  tirads:        number | null;
  confidence:    number | null;
  modelVersion:  string | null;
  exportedAt:    string | null;
}

interface ScanStats {
  totalScans:     number;
  scansThisMonth: number;
  highRiskCount:  number;
  neverExported:  number;
}

// ── Helpers ────────────────────────────────────────────────
const TIRADS_STYLE: Record<number, string> = {
  1: "bg-green-100 text-green-800",
  2: "bg-green-100 text-green-800",
  3: "bg-yellow-100 text-yellow-800",
  4: "bg-orange-100 text-orange-800",
  5: "bg-red-100   text-red-800",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const PAGE_SIZE = 15;

type ExportedFilter = "all" | "exported" | "never";
type DateFilter     = "all" | "week" | "month";
type SortBy         = "newest" | "oldest" | "tirads_desc" | "confidence_asc";

const TIRADS_OPTS = [
  { label: "All TI-RADS", value: null },
  { label: "TR1 — Benign",          value: 1 },
  { label: "TR2 — Not suspicious",  value: 2 },
  { label: "TR3 — Mildly suspicious", value: 3 },
  { label: "TR4 — Moderately suspicious", value: 4 },
  { label: "TR5 — Highly suspicious", value: 5 },
];

const EXPORT_OPTS: { label: string; value: ExportedFilter }[] = [
  { label: "All scans",      value: "all" },
  { label: "Exported",       value: "exported" },
  { label: "Never exported", value: "never" },
];

const DATE_OPTS: { label: string; value: DateFilter }[] = [
  { label: "All time",    value: "all" },
  { label: "This week",   value: "week" },
  { label: "This month",  value: "month" },
];

const SORT_OPTS: { label: string; value: SortBy }[] = [
  { label: "Newest first",        value: "newest" },
  { label: "Oldest first",        value: "oldest" },
  { label: "Highest risk first",  value: "tirads_desc" },
  { label: "Lowest confidence",   value: "confidence_asc" },
];

// ── Copy button ────────────────────────────────────────────
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
      className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied
        ? <Check className="h-3 w-3 text-green-500" />
        : <Copy className="h-3 w-3" />
      }
    </button>
  );
}

// ── Stat card ──────────────────────────────────────────────
function StatCard({
  label, value, color,
}: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-4 border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-2xl font-medium", color ?? "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

// ── Table skeleton ─────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3 px-4 py-3 border-b border-border/40"
          style={{ gridTemplateColumns: "160px 1fr 90px 60px 60px 100px 160px" }}
        >
          <Skeleton className="h-4 w-32" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-10 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function ScansPage() {
  const supabase = createClient();

  const [scans,      setScans]      = useState<Scan[]>([]);
  const [stats,      setStats]      = useState<ScanStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page,       setPage]       = useState(0);

  // Filters
  const [query,      setQuery]      = useState("");
  const [tirads,     setTirads]     = useState<number | null>(null);
  const [exported,   setExported]   = useState<ExportedFilter>("all");
  const [dateRange,  setDateRange]  = useState<DateFilter>("all");
  const [sortBy,     setSortBy]     = useState<SortBy>("newest");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // ── Fetch stats ──────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const { data } = await supabase.rpc("get_scan_stats");
    const s = data?.[0];
    if (s) {
      setStats({
        totalScans:     Number(s.total_scans)      || 0,
        scansThisMonth: Number(s.scans_this_month) || 0,
        highRiskCount:  Number(s.high_risk_count)  || 0,
        neverExported:  Number(s.never_exported)   || 0,
      });
    }
  }, []);

  // ── Fetch scans ──────────────────────────────────────────
  const fetchScans = useCallback(async (pg: number, q: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_all_scans", {
        p_query:      q      || null,
        p_tirads:     tirads || null,
        p_exported:   exported,
        p_date_range: dateRange,
        p_sort_by:    sortBy,
        p_limit:      PAGE_SIZE,
        p_offset:     pg * PAGE_SIZE,
      });
      if (error) throw error;

      const rows = (data || []) as any[];
      if (rows.length > 0) setTotalCount(Number(rows[0].total_count) || 0);
      else setTotalCount(0);

      setScans(rows.map((r: any) => ({
        rawImageId:   r.raw_image_id,
        predictionId: r.prediction_id,
        reportId:     r.report_id,
        patientId:    r.patient_id,
        patientName:  `${r.first_name} ${r.last_name}`,
        age:          r.age,
        gender:       r.gender,
        uploadedAt:   r.uploaded_at,
        tirads:       r.tirads,
        confidence:   r.confidence,
        modelVersion: r.model_version,
        exportedAt:   r.exported_at,
      })));
    } catch (err) {
      console.error("Error fetching scans:", err);
    } finally {
      setLoading(false);
    }
  }, [tirads, exported, dateRange, sortBy]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      fetchScans(0, query);
    }, 300);
  }, [query, tirads, exported, dateRange, sortBy]);

  useEffect(() => {
    fetchScans(page, query);
  }, [page]);

  useEffect(() => {
    fetchStats();
  }, []);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Active filter count for badge
  const activeFilters = [
    tirads !== null,
    exported !== "all",
    dateRange !== "all",
    sortBy !== "newest",
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <header className="flex h-16 items-center gap-3 px-6 border-b border-border/50 shrink-0">
          <Separator orientation="vertical" className="h-4" />
          <ScanLine className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Scans &amp; Reports</span>
          {totalCount > 0 && (
            <Badge variant="outline" className="text-[11px] ml-1 bg-muted/30 text-muted-foreground border-border/50">
              {totalCount} total
            </Badge>
          )}
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-5">

          {/* ── Stats strip ── */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Total scans"     value={stats?.totalScans     ?? "—"} />
            <StatCard label="This month"      value={stats?.scansThisMonth ?? "—"} />
            <StatCard
              label="High risk (TR4/5)"
              value={stats?.highRiskCount ?? "—"}
              color={stats?.highRiskCount ? "text-red-600" : undefined}
            />
            <StatCard
              label="Never exported"
              value={stats?.neverExported ?? "—"}
              color={stats?.neverExported ? "text-amber-600" : undefined}
            />
          </div>

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by report ID or patient name..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm border border-border/60 rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>

            {/* TI-RADS filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                  <Filter className="h-3 w-3" />
                  {tirads ? `TR${tirads}` : "TI-RADS"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {TIRADS_OPTS.map(o => (
                  <DropdownMenuItem
                    key={String(o.value)}
                    onClick={() => { setTirads(o.value); setPage(0); }}
                    className={cn(tirads === o.value && "text-primary font-medium")}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Exported filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                  <FileDown className="h-3 w-3" />
                  {EXPORT_OPTS.find(o => o.value === exported)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {EXPORT_OPTS.map(o => (
                  <DropdownMenuItem
                    key={o.value}
                    onClick={() => { setExported(o.value); setPage(0); }}
                    className={cn(exported === o.value && "text-primary font-medium")}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date range */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs">
                  {DATE_OPTS.find(o => o.value === dateRange)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {DATE_OPTS.map(o => (
                  <DropdownMenuItem
                    key={o.value}
                    onClick={() => { setDateRange(o.value); setPage(0); }}
                    className={cn(dateRange === o.value && "text-primary font-medium")}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                  <ArrowUpDown className="h-3 w-3" />
                  {SORT_OPTS.find(o => o.value === sortBy)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_OPTS.map(o => (
                  <DropdownMenuItem
                    key={o.value}
                    onClick={() => { setSortBy(o.value); setPage(0); }}
                    className={cn(sortBy === o.value && "text-primary font-medium")}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={() => {
                  setTirads(null);
                  setExported("all");
                  setDateRange("all");
                  setSortBy("newest");
                  setPage(0);
                }}
              >
                Clear ({activeFilters})
              </Button>
            )}
          </div>

          {/* ── Table ── */}
          <div className="bg-background border border-border/50 rounded-lg overflow-hidden">

            {/* Table header */}
            <div
              className="hidden md:grid gap-3 px-4 py-2.5 border-b border-border/50 bg-muted/30"
              style={{ gridTemplateColumns: "160px 1fr 90px 60px 60px 100px 160px" }}
            >
              {["Report ID", "Patient", "Scan date", "TR", "Conf.", "Exported", "Actions"].map(h => (
                <div key={h} className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {loading ? (
              <TableSkeleton />
            ) : scans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ScanLine className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No scans found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              scans.map((scan, i) => (
                <div
                  key={scan.rawImageId}
                  className={cn(
                    "grid gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors",
                    i < scans.length - 1 && "border-b border-border/40",
                  )}
                  style={{ gridTemplateColumns: "160px 1fr 90px 60px 60px 100px 160px" }}
                >
                  {/* Report ID */}
                  <div className="flex items-center min-w-0">
                    <span className="font-mono text-[12px] text-primary truncate">
                      {scan.reportId ?? "—"}
                    </span>
                    {scan.reportId && <CopyButton text={scan.reportId} />}
                  </div>

                  {/* Patient */}
                  <div className="min-w-0">
                    <Link
                      href={`/patients/${scan.patientId}`}
                      className="text-sm font-medium hover:underline truncate block"
                    >
                      {scan.patientName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {scan.age}y · {scan.gender}
                    </p>
                  </div>

                  {/* Scan date */}
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(scan.uploadedAt)}
                  </div>

                  {/* TI-RADS */}
                  <div>
                    {scan.tirads ? (
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                        TIRADS_STYLE[scan.tirads],
                      )}>
                        TR{scan.tirads}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>

                  {/* Confidence */}
                  <div className="text-xs text-muted-foreground">
                    {scan.confidence != null
                      ? `${Math.round(scan.confidence * 100)}%`
                      : "—"}
                  </div>

                  {/* Exported */}
                  <div>
                    {scan.exportedAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800">
                        {formatDate(scan.exportedAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] text-muted-foreground border border-border/60">
                        Never
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Link href={`/analysis/${scan.predictionId}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px] gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] gap-1"
                      onClick={() => toast.info("Export coming soon")}
                    >
                      <FileDown className="h-3 w-3" />
                      {scan.exportedAt ? "Re-export" : "Export"}
                    </Button>
                  </div>
                </div>
              ))
            )}

            {/* Pagination */}
            {!loading && totalCount > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/10">
                <span className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = page < 3
                      ? i
                      : page > totalPages - 4
                        ? totalPages - 5 + i
                        : page - 2 + i;
                    if (pg < 0 || pg >= totalPages) return null;
                    return (
                      <Button
                        key={pg}
                        variant={pg === page ? "default" : "outline"}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setPage(pg)}
                      >
                        {pg + 1}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </main>
    </div>
  );
}