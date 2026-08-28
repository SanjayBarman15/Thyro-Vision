// components/admin/performance/PerformanceClient.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { PerformanceData } from "./types";
import StatsCards from "./StatsCards";
import TiradsChart from "./TiradsChart";
import ConfidenceChart from "./ConfidenceChart";
import AccuracyChart from "./AccuracyChart";
import VersionTable from "./VersionTable";
import { BenchmarkStatus, BenchmarkSummary, parseBenchmarkSummary } from '../benchmark/types';
import BenchmarkProgressBar from "../benchmark/BenchmarkProgressBar";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { BackendStatusBadge } from "../shared/BackendStatusBadge";
import { goeyToast as toast } from "@/components/ui/goey-toaster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, BarChart2, FlaskConical, Layers, Activity, History, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const supabase      = createClient();
const POLL_INTERVAL = 30_000;

export default function PerformanceClient({
  initialData,
}: {
  initialData: PerformanceData;
}) {
  const [data,           setData]           = useState<PerformanceData>(initialData);
  const [isSnapshotting, setIsSnapshotting] = useState(false);
  const [snapMode,       setSnapMode]       = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState("live");
  const [benchmarkHistory, setBenchmarkHistory] = useState<any[]>([]);
  const [benchmarkStatus, setBenchmarkStatus]   = useState<BenchmarkStatus | null>(null);
  const [isLoadingBenchmark, setIsLoadingBenchmark] = useState(false);
  
  const wasRunningRef = useRef(false);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, lastOnline, isRefreshing: isStatusChecking, checkHealth } = useBackendStatus();

  // ── Fetch all performance data ────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [
        { data: totalScans },
        { data: inferenceTime },
        { data: modelAccuracy },
        { data: flaggedCount },
        { data: feedbackRate },
        { data: tiradsData },
        { data: confidenceData },
        { data: accuracyHistory },
        { data: versionData },
      ] = await Promise.all([
        supabase.rpc("get_total_scans"),
        supabase.rpc("get_avg_inference_time"),
        supabase.rpc("get_model_accuracy"),
        supabase.rpc("get_flagged_count"),
        supabase.rpc("get_feedback_rate"),
        supabase.rpc("get_tirads_distribution"),
        supabase.rpc("get_confidence_distribution"),
        supabase.rpc("get_accuracy_over_time"),
        supabase.rpc("get_version_comparison"),
      ]);

      setData({
        totalScans:      totalScans ?? 0,
        inferenceTime:   inferenceTime?.[0] ?? { ms: 0, seconds: 0 },
        modelAccuracy:   modelAccuracy ?? null,
        flaggedCount:    flaggedCount ?? 0,
        feedbackRate:    feedbackRate ?? 0,
        tiradsData:      tiradsData ?? [],
        confidenceData:  confidenceData ?? [],
        accuracyHistory: accuracyHistory ?? [],
        versionData:     versionData ?? [],
      });
    } catch (error) {
      console.error("Performance data fetch failed:", error);
    }
  }, []);

  const fetchBenchmarkHistory = useCallback(async () => {
    setIsLoadingBenchmark(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/benchmark/history", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.history) setBenchmarkHistory(data.history.map(parseBenchmarkSummary));
    } catch (error) {
      console.error("Benchmark history fetch failed:", error);
    } finally {
      setIsLoadingBenchmark(false);
    }
  }, []);

  const pollBenchmarkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/benchmark/status");
      const data: BenchmarkStatus = await res.json();
      setBenchmarkStatus(data);

      if (data.running) {
        wasRunningRef.current = true;
      } else if (wasRunningRef.current) {
        // Just finished!
        wasRunningRef.current = false;
        fetchBenchmarkHistory();
        toast.success("Benchmark Complete", {
          description: "New results have been loaded automatically."
        });
      }
    } catch (e) {
      console.error("Benchmark status poll failed:", e);
    }
  }, [fetchBenchmarkHistory]);

  // ── Polling ───────────────────────────────────────────────
  useEffect(() => {
    fetchData();
    fetchBenchmarkHistory();
    pollBenchmarkStatus(); // Initial status check

    const interval = setInterval(() => {
      fetchData();
      if (activeTab === "benchmark") fetchBenchmarkHistory();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchData, fetchBenchmarkHistory, pollBenchmarkStatus, activeTab]);

  // Dedicated high-frequency poll when benchmark is running
  useEffect(() => {
    if (benchmarkStatus?.running && !statusPollRef.current) {
      statusPollRef.current = setInterval(pollBenchmarkStatus, 3000);
    } else if (!benchmarkStatus?.running && statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
    return () => {
      if (statusPollRef.current) {
        clearInterval(statusPollRef.current);
        statusPollRef.current = null;
      }
    };
  }, [benchmarkStatus?.running, pollBenchmarkStatus]);

  // ── Log Performance (production snapshot) ────────────────
  const handleSnapshot = async (mode: 'production' | 'benchmark' | 'both') => {
    if (isSnapshotting) return;

    if (status !== 'online') {
      toast.error("Action Unavailable", {
        description: "Cannot log performance while backend is offline."
      });
      return;
    }

    setIsSnapshotting(true);
    setSnapMode(mode);

    try {
      if (mode === 'production' || mode === 'both') {
        // Production snapshot — synchronous, instant
        const res = await fetch("/api/admin/performance/snapshot", {
          method: "POST"
        });
        if (!res.ok) throw new Error('Production snapshot failed');
        await fetchData();
        toast.success("Production metrics logged", {
          description: "Performance snapshot saved successfully."
        });
      }

      if (mode === 'benchmark' || mode === 'both') {
        // Benchmark — async, queued via Celery
        // Navigate to benchmark page so admin can watch progress
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/benchmark/trigger', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        const data = await res.json();

        if (res.status === 202) {
          toast('Benchmark started', {
            description: '20 images queued — tracking progress below...',
          });
          setActiveTab('benchmark');
          await pollBenchmarkStatus();
        } else if (res.status === 423) {
          toast.error('Benchmark already running', {
            description: `Started by ${data.started_by}`,
          });
        } else if (res.status === 429) {
          toast.error('Benchmark cooldown active', {
            description: data.message,
          });
        }
      }
    } catch (err: any) {
      toast.error("Failed to log performance", {
        description: err.message || "An error occurred."
      });
    } finally {
      setIsSnapshotting(false);
      setSnapMode(null);
    }
  };

  const buttonLabel = () => {
    if (!isSnapshotting) return "📊 Log Performance";
    if (snapMode === 'production') return "⏳ Recording...";
    if (snapMode === 'benchmark')  return "⏳ Queuing...";
    if (snapMode === 'both')       return "⏳ Running...";
    return "⏳ Working...";
  };

  return (
    <div className="space-y-6 p-6 custom-scrollbar">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Performance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time monitoring of model performance and system health
          </p>
        </div>

        <div className="flex items-center gap-4">
          <BackendStatusBadge
            status={status}
            lastOnline={lastOnline}
            isRefreshing={isStatusChecking}
            onRefresh={checkHealth}
            showLastSeen={true}
          />

          {/* ── Log Performance dropdown ── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isSnapshotting}
                className="flex items-center gap-2 px-4 py-2 text-sm
                           bg-[#1e2736] hover:bg-[#2d3748] text-white
                           rounded-lg border border-[#2d3748] transition-colors
                           cursor-pointer disabled:opacity-50
                           disabled:cursor-not-allowed"
              >
                {buttonLabel()}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-[#0f1623] border border-[#1e2736]
                          rounded-xl shadow-2xl"
            >
              {/* Production */}
              <DropdownMenuItem
                onClick={() => handleSnapshot('production')}
                className="flex items-start gap-3 p-3 cursor-pointer
                            hover:bg-[#1e2736] rounded-lg"
              >
                <BarChart2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Production Metrics
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Snapshot from real doctor usage — instant
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[#1e2736]" />

              {/* Benchmark */}
              <DropdownMenuItem
                onClick={() => handleSnapshot('benchmark')}
                className="flex items-start gap-3 p-3 cursor-pointer
                            hover:bg-[#1e2736] rounded-lg"
              >
                <FlaskConical className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Benchmark Metrics
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fixed 20-image test set — ~2 min, async
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[#1e2736]" />

              {/* Both */}
              <DropdownMenuItem
                onClick={() => handleSnapshot('both')}
                className="flex items-start gap-3 p-3 cursor-pointer
                            hover:bg-[#1e2736] rounded-lg"
              >
                <Layers className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white">
                    Both
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Production (instant) + Benchmark (async)
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <StatsCards
        totalScans={data.totalScans}
        inferenceTime={data.inferenceTime}
        modelAccuracy={data.modelAccuracy}
        flaggedCount={data.flaggedCount}
        feedbackRate={data.feedbackRate}
      />

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TiradsChart data={data.tiradsData} />
        <ConfidenceChart data={data.confidenceData} />
      </div>

      <div className="pt-4 border-t border-[#1e2736]/50">
        <div className="mb-4 flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
            <TabsList className="bg-[#1e2736] border border-[#2d3748] h-11 p-1">
              <TabsTrigger
                value="live"
                className="data-[state=active]:bg-blue-500 data-[state=active]:text-white
                           text-xs font-semibold rounded-md px-4 py-2 transition-all"
              >
                <Activity className="w-3.5 h-3.5 mr-2" />
                Live Performance
              </TabsTrigger>
              <TabsTrigger
                value="benchmark"
                className="data-[state=active]:bg-purple-500 data-[state=active]:text-white
                           text-xs font-semibold rounded-md px-4 py-2 transition-all"
              >
                <History className="w-3.5 h-3.5 mr-2" />
                Benchmark Runs
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {activeTab === 'benchmark' && (
            <div className="mb-4">
              <BenchmarkProgressBar status={benchmarkStatus} />
            </div>
          )}

          {activeTab === 'benchmark' && isLoadingBenchmark && !benchmarkStatus?.running && (
            <div className="flex items-center text-xs text-muted-foreground animate-pulse">
              <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
              Refreshing benchmark results...
            </div>
          )}
        </div>

        {/* ── Accuracy Over Time ── */}
        <AccuracyChart
          title={activeTab === 'live' ? "Performance Over Time" : "Benchmark Performance"}
          description={activeTab === 'live'
            ? "Accuracy and confidence trends across model versions"
            : "TI-RADS accuracy across benchmark runs (fixed test set)"
          }
          hideConfidence={activeTab === 'benchmark'}
          data={activeTab === 'live'
            ? data.accuracyHistory
            : benchmarkHistory.map(h => ({
                recorded_at: h.recorded_at,
                model_version: h.pipeline_version || 'unknown',
                accuracy: (h.benchmark_tirads_accuracy || 0) * 100,
                avg_confidence: 0,
                avg_inference_ms: (h.benchmark_avg_roi_ms || 0) + (h.benchmark_avg_xception_ms || 0)
              }))
          }
        />

        {/* ── Version Comparison ── */}
        <div className="mt-6">
          <VersionTable
            title={activeTab === 'live' ? "Model Version Comparison" : "Benchmark Runs"}
            description={activeTab === 'live'
              ? "Performance metrics across all deployed pipeline versions"
              : "Historical benchmark results with IoU and accuracy aggregates"
            }
            data={activeTab === 'live'
              ? data.versionData
              : benchmarkHistory.map(h => ({
                  model_version: h.pipeline_version || 'unknown',
                  pipeline_version: h.pipeline_version || 'unknown',
                  model_metadata: h.model_metadata || null,
                  total_predictions: h.benchmark_dataset_size || 0,
                  correct_predictions: Math.round((h.benchmark_tirads_accuracy || 0) * (h.benchmark_dataset_size || 0)),
                  accuracy: (h.benchmark_tirads_accuracy || 0) * 100,
                  avg_confidence: null,
                  avg_inference_ms: (h.benchmark_avg_roi_ms || 0) + (h.benchmark_avg_xception_ms || 0),
                  tirads_distribution: null,
                  feedback_rate: 100,
                  recorded_at: h.recorded_at
                }))
            }
          />
        </div>
      </div>
    </div>
  );
}