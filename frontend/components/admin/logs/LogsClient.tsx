// components/admin/logs/LogsClient.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { LogEntry, LogStats, LogFilters } from "./types";
import LogsStatsBar from "./LogsStatsBar";
import { goeyToast as toast } from "@/components/ui/goey-toaster";
import LogsFilters from "./LogsFilters";
import LogsTable from "./LogsTable";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { BackendStatusBadge } from "../shared/BackendStatusBadge";

// Single instance outside component — prevents re-render loop
const supabase = createClient();
const POLL_INTERVAL = 30_000;

const DEFAULT_FILTERS: LogFilters = {
  level: "ALL",
  actor_role: "ALL",
  search: "",
  from: "",
  to: "",
};

interface Props {
  initialLogs: LogEntry[];
  initialStats: LogStats[];
}

export default function LogsClient({ initialLogs, initialStats }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [stats, setStats] = useState<LogStats[]>(initialStats);
  const [filters, setFilters] = useState<LogFilters>(DEFAULT_FILTERS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const {
    status: backendStatus,
    lastOnline,
    isRefreshing: isStatusChecking,
    checkHealth,
  } = useBackendStatus();
  const LIMIT = 50;

  // ── Fetch logs with current filters ──────────────────────
  const fetchLogs = useCallback(
    async (currentFilters: LogFilters, currentPage: number, append = false) => {
      setIsRefreshing(true);
      try {
        const params: Record<string, any> = {
          p_limit: LIMIT,
          p_offset: currentPage * LIMIT,
        };

        if (currentFilters.level !== "ALL")
          params.p_level = currentFilters.level;
        if (currentFilters.actor_role !== "ALL")
          params.p_actor_role = currentFilters.actor_role;
        if (currentFilters.search) params.p_search = currentFilters.search;
        if (currentFilters.from) params.p_from = currentFilters.from;
        if (currentFilters.to) params.p_to = currentFilters.to;

        const [{ data: newLogs }, { data: newStats }] = await Promise.all([
          supabase.rpc("get_system_logs", params),
          supabase.rpc("get_log_stats"),
        ]);

        const logsData = newLogs ?? [];

        setLogs((prev) => (append ? [...prev, ...logsData] : logsData));
        setStats(newStats ?? []);
        setHasMore(logsData.length === LIMIT);
      } catch (error) {
        console.error("Logs fetch failed:", error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [],
  );

  // ── When filters change — reset to page 0 ────────────────
  useEffect(() => {
    setPage(0);
    fetchLogs(filters, 0, false);
  }, [filters, fetchLogs]);

  // ── Live polling every 30s ────────────────────────────────
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      fetchLogs(filters, 0, false);
      setPage(0);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isLive, filters, fetchLogs]);

  // ── Load more (pagination) ────────────────────────────────
  const loadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(filters, nextPage, true);
  }, [page, filters, fetchLogs]);

  // ── Export CSV ────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const headers = [
      "timestamp",
      "level",
      "action",
      "actor_role",
      "resource_type",
      "error_code",
      "error_message",
      "request_id",
    ];
    const rows = logs.map((log) => [
      log.created_at,
      log.level,
      log.action,
      log.actor_role ?? "",
      log.resource_type ?? "",
      log.error_code ?? "",
      log.error_message ?? "",
      log.request_id,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `thyrovision-logs-${new Date().toISOString().split("T")[0]}.csv`;
    toast.success("Logs Exported", {
      description: `CSV file generated for ${logs.length} entries.`,
    });
    URL.revokeObjectURL(url);
  }, [logs]);

  return (
    <div className="space-y-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time audit trail of all system activity
          </p>
        </div>

        <div className="flex items-center gap-4">
          <BackendStatusBadge
            status={isLive ? backendStatus : "offline"} // Show as 'offline' generic icon if paused, or just hide?
            lastOnline={lastOnline}
            isRefreshing={isStatusChecking}
            onRefresh={checkHealth}
            showLastSeen={true}
          />
          {/* Backend Status & Live Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLive((prev) => !prev)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer
                ${
                  isLive
                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                    : "bg-[#1e2736] border-[#2d3748] text-muted-foreground hover:bg-[#2d3748]"
                }`}
            >
              {isLive ? "⏸ Pause Auto-refresh" : "▶ Resume Auto-refresh"}
            </button>
            {/* Export CSV */}
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 text-sm
                       bg-[#1e2736] hover:bg-[#2d3748]
                       text-white rounded-lg border border-[#2d3748]
                       transition-colors cursor-pointer"
            >
              ⬇ Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <LogsStatsBar stats={stats} />

      {/* ── Filters ── */}
      <LogsFilters
        filters={filters}
        onChange={setFilters}
        isRefreshing={isRefreshing}
      />

      {/* ── Logs Table ── */}
      <LogsTable logs={logs} isRefreshing={isRefreshing} />

      {/* ── Load More ── */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={isRefreshing}
            className="px-6 py-2 text-sm bg-[#1e2736] hover:bg-[#2d3748]
                       text-white rounded-lg border border-[#2d3748]
                       transition-colors disabled:opacity-50
                       disabled:cursor-not-allowed cursor-pointer"
          >
            {isRefreshing ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
