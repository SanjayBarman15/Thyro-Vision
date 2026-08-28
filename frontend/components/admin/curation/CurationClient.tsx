// components/admin/curation/CurationClient.tsx
"use client";

import { useEffect, useCallback, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { CurationLabel, CurationStats, FilterType, ExportMode } from "./types";
import CurationStatsBar from "./CurationStatsBar";
import CurationFilters from "./CurationFilters";
import CurationQueue from "./CurationQueue";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { Download, ChevronDown } from "lucide-react";
import { goeyToast as toast } from "@/components/ui/goey-toaster";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { BackendStatusBadge } from "../shared/BackendStatusBadge";

// Single instance outside component
const supabase = createClient();

// ── Query keys ────────────────────────────────────────────
const QUEUE_KEY = (filter: FilterType) => ["curation-queue", filter];
const STATS_KEY = () => ["curation-stats"];

// ── Fetchers ──────────────────────────────────────────────
async function fetchQueue(
  filter: FilterType,
  page = 0,
): Promise<CurationLabel[]> {
  const { data, error } = await supabase.rpc("get_curation_queue", {
    p_limit: 50,
    p_offset: page * 50,
    p_filter: filter,
  });
  if (error) throw error;
  return data ?? [];
}

async function fetchStats(): Promise<CurationStats> {
  const { data, error } = await supabase.rpc("get_curation_stats");
  if (error) throw error;
  return (
    data?.[0] ?? {
      total_draft: 0,
      total_approved: 0,
      total_rejected: 0,
      total_claimed: 0,
      total_new: 0, // new field — safe default
      needs_bbox: 0,
      needs_tirads: 0,
      needs_both: 0,
    }
  );
}

interface Props {
  initialLabels: CurationLabel[];
  initialStats: CurationStats;
}

export default function CurationClient({ initialLabels, initialStats }: Props) {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterType>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMode, setExportMode] = useState<ExportMode>("full");
  const [showModeMenu, setShowModeMenu] = useState(false);

  const {
    status,
    lastOnline,
    isRefreshing: isStatusChecking,
    checkHealth,
  } = useBackendStatus();

  // ── Queue query ───────────────────────────────────────────
  const {
    data: labels = initialLabels,
    isLoading: isLoadingQueue,
    isFetching: isRefreshing,
  } = useQuery({
    queryKey: QUEUE_KEY(filter),
    queryFn: () => fetchQueue(filter),
    initialData: filter === "all" ? initialLabels : undefined,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // ── Stats query ───────────────────────────────────────────
  const { data: stats = initialStats } = useQuery({
    queryKey: STATS_KEY(),
    queryFn: fetchStats,
    initialData: initialStats,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // ── Supabase Realtime subscription ───────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("training_labels_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "training_labels" },
        () => {
          queryClient.invalidateQueries({ queryKey: QUEUE_KEY(filter) });
          queryClient.invalidateQueries({ queryKey: STATS_KEY() });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter, queryClient]);

  // ── Release expired claims on mount ──────────────────────
  useEffect(() => {
    fetch("/api/admin/curation/release-claims", { method: "POST" }).catch(
      console.error,
    );
  }, []);

  // ── Close mode menu on outside click ─────────────────────
  useEffect(() => {
    if (!showModeMenu) return;
    const handler = () => setShowModeMenu(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showModeMenu]);

  // ── Claim mutation (optimistic) ───────────────────────────
  const claimMutation = useMutation({
    mutationFn: async (labelId: string) => {
      if (!user?.id) throw new Error("No user");
      const { data: claimed } = await supabase.rpc("claim_training_label", {
        p_label_id: labelId,
        p_admin_id: user.id,
      });
      if (!claimed) throw new Error("CLAIM_FAILED");
      return labelId;
    },

    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: QUEUE_KEY(filter) });
      const previous = queryClient.getQueryData<CurationLabel[]>(
        QUEUE_KEY(filter),
      );
      queryClient.setQueryData<CurationLabel[]>(QUEUE_KEY(filter), (old = []) =>
        old.map((label) =>
          label.id === labelId
            ? {
                ...label,
                claimed_by: user?.id ?? null,
                claimed_at: new Date().toISOString(),
                claimer_name: user?.user_metadata?.full_name ?? "You",
              }
            : label,
        ),
      );
      return { previous };
    },

    onSuccess: (labelId) => {
      router.push(`/admin/curation/${labelId}`);
    },

    onError: (error, labelId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUEUE_KEY(filter), context.previous);
      }
      if (error.message === "CLAIM_FAILED") {
        toast.error("Claim Failed", {
          description:
            "This label was just claimed by another admin. Please choose another.",
        });
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY(filter) });
      queryClient.invalidateQueries({ queryKey: STATS_KEY() });
    },
  });

  // ── Filter change ─────────────────────────────────────────
  const handleFilterChange = useCallback(
    (newFilter: FilterType) => {
      setFilter(newFilter);
      queryClient.prefetchQuery({
        queryKey: QUEUE_KEY(newFilter),
        queryFn: () => fetchQueue(newFilter),
      });
    },
    [queryClient],
  );

  // ── Export dataset ────────────────────────────────────────
  const exportDataset = useCallback(
    async (mode: ExportMode) => {
      setIsExporting(true);
      try {
        // Build URL with mode query param — hits Next.js route which proxies to FastAPI
        const url = `/api/admin/curation/export?mode=${mode}`;

        const response = await fetch(url, { method: "POST" });

        if (!response.ok) {
          // Try to get the error detail from FastAPI
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || "Export failed");
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        // Use filename from Content-Disposition if available, otherwise build one
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        a.download =
          match?.[1] ??
          `thyrovision-dataset-${mode}-${new Date().toISOString().split("T")[0]}.zip`;
        a.click();
        URL.revokeObjectURL(downloadUrl);

        // Read response headers for included/skipped counts
        const included = response.headers.get("X-Included-Labels") ?? "?";
        const skipped = response.headers.get("X-Skipped-Labels") ?? "0";

        toast.success("Export Complete", {
          description:
            skipped !== "0"
              ? `${included} labels exported · ${skipped} skipped (see manifest.json)`
              : `${included} labels exported successfully`,
        });

        // Invalidate stats — exported_at is now set, total_new will drop
        queryClient.invalidateQueries({ queryKey: STATS_KEY() });
      } catch (error: any) {
        console.error("Export failed:", error);
        toast.error("Export Failed", {
          description:
            error.message ?? "Please check your connection and try again.",
        });
      } finally {
        setIsExporting(false);
      }
    },
    [queryClient],
  );

  // ── Derived export button label ───────────────────────────
  // Matches your team's spec exactly:
  //   "Export Dataset (3 new / 3 total)"       ← before any export
  //   "Export Dataset (0 new / 3 — all exported)" ← after full export
  //   "Export Dataset (2 new / 5 total)"        ← after more approvals
  const exportButtonLabel = (() => {
    if (isExporting) return "Exporting...";
    if (stats.total_new > 0) {
      return `Export Dataset ( ${stats.total_new} new / ${stats.total_approved} total )`;
    }
    return `Export Dataset (${stats.total_approved} — all exported)`;
  })();

  // Show the mode dropdown only when there's a meaningful choice:
  // some labels are new AND some have already been exported before
  const showModeSelector =
    stats.total_new > 0 && stats.total_new < stats.total_approved;

  const isExportDisabled = isExporting || stats.total_approved === 0;

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dataset Curation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and annotate training labels for model retraining
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* ── Export button group (badge + buttons) ── */}
          <BackendStatusBadge
            status={status}
            lastOnline={lastOnline}
            isRefreshing={isStatusChecking || isRefreshing}
            onRefresh={checkHealth}
            showLastSeen={true}
          />
          {/* Wrapper for flush buttons */}
          <div className="flex items-stretch">
            {/* Main export button */}
            <button
              onClick={() => exportDataset(exportMode)}
              disabled={isExportDisabled}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm
                bg-[#1e2736] hover:bg-[#2d3748]
                text-white border border-[#2d3748]
                transition-colors cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed
                ${showModeSelector ? "rounded-l-lg border-r-0" : "rounded-lg"}
              `}
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{exportButtonLabel}</span>
            </button>

            {/* Mode dropdown — only visible when there's a meaningful choice */}
            {showModeSelector && (
              <div className="relative flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowModeMenu((prev) => !prev);
                  }}
                  disabled={isExportDisabled}
                  className="
                    flex items-center justify-center px-2 py-2 text-sm h-full
                    bg-[#1e2736] hover:bg-[#2d3748]
                    text-white rounded-r-lg border border-[#2d3748]
                    transition-colors cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  aria-label="Select export mode"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showModeMenu && (
                  <div
                    className="
                      absolute right-0 top-full mt-1 z-50 w-56
                      bg-[#1e2736] border border-[#2d3748]
                      rounded-lg shadow-lg overflow-hidden
                    "
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Full export option */}
                    <button
                      onClick={() => {
                        setExportMode("full");
                        setShowModeMenu(false);
                        exportDataset("full");
                      }}
                      className="
                        w-full text-left px-4 py-3
                        hover:bg-[#2d3748] transition-colors
                        border-b border-[#2d3748]
                      "
                    >
                      <p className="text-sm font-medium text-white">
                        Full dataset
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        All {stats.total_approved} approved labels
                      </p>
                    </button>

                    {/* Incremental export option */}
                    <button
                      onClick={() => {
                        setExportMode("incremental");
                        setShowModeMenu(false);
                        exportDataset("incremental");
                      }}
                      className="
                        w-full text-left px-4 py-3
                        hover:bg-[#2d3748] transition-colors
                      "
                    >
                      <p className="text-sm font-medium text-white">New only</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {stats.total_new} labels since last export
                      </p>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <CurationStatsBar stats={stats} />

      {/* ── Filters ── */}
      <CurationFilters
        filter={filter}
        onChange={handleFilterChange}
        stats={stats}
      />

      {/* ── Queue ── */}
      <CurationQueue
        labels={labels}
        isRefreshing={isRefreshing && !isLoadingQueue}
        onClaim={(id) => claimMutation.mutateAsync(id)}
        currentAdminId={user?.id ?? ""}
        claimingId={
          claimMutation.isPending ? String(claimMutation.variables) : null
        }
      />
    </div>
  );
}
