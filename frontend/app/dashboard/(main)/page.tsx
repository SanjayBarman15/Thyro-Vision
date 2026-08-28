// frontend/app/dashboard/(main)/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Clock3,
  ArrowDownAZ,
  TrendingDown,
  AlertCircle,
  X,
  Users,
  ScanLine,
  ShieldAlert,
  Bell,
} from "lucide-react";
import NewScanPanel from "@/components/new-scan-panel";
import PatientCard from "@/components/dashboard/patient-card";
import EmptyState from "@/components/dashboard/empty-state";
import { useStore } from "@/store/useStore";
import { goeyToast as toast } from "@/components/ui/goey-toaster";

// ── Stats card ────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4
                     flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center
                        justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

// ── Active filter pill ────────────────────────────────────
function FilterPill({
  label, onRemove,
}: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs px-2.5 py-1
                      bg-primary/10 text-primary rounded-full border
                      border-primary/20">
      {label}
      <button onClick={onRemove} className="hover:text-foreground ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Main dashboard content ────────────────────────────────
function DashboardContent() {
  const {
    patients, stats, loading, doctorName,
    searchQuery, filterTirads, filterOverdue, sortBy,
    setSearchQuery, setFilterTirads, setFilterOverdue, setSortBy,
    fetchProfile, fetchDashboardData,
    isNewScanOpen, setIsNewScanOpen,
  } = useStore();

  const searchParams = useSearchParams();
  const router       = useRouter();
  const searchRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth toasts ───────────────────────────────────────────
  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login")  toast.success("Welcome back!");
    if (auth === "signup") toast.success("Account created successfully!");
    if (auth) {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("auth");
      router.replace(`/dashboard${p.toString() ? `?${p}` : ""}`);
    }
  }, [searchParams, router]);

  // ── Initial data load ─────────────────────────────────────
  useEffect(() => {
    fetchProfile();
    fetchDashboardData();
  }, [fetchProfile, fetchDashboardData]);

  // ── Debounced search ──────────────────────────────────────
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      fetchDashboardData();
    }, 350);
  }, [setSearchQuery, fetchDashboardData]);

  // ── Sort + filter patients client-side ────────────────────
  const sortedPatients = [...patients].sort((a, b) => {
    if (sortBy === "recent") {
      return new Date(b.lastScan || 0).getTime() -
             new Date(a.lastScan || 0).getTime();
    }
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "tirads") {
      return (b.tiradsNum ?? 0) - (a.tiradsNum ?? 0);
    }
    if (sortBy === "overdue") {
      return (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0);
    }
    return 0;
  });

  // Active filters count
  const activeFiltersCount = (filterTirads ? 1 : 0) + (filterOverdue ? 1 : 0);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0">

          {/* ── Top bar ── */}
          <header className="sticky top-0 z-30 border-b border-border/50
                              bg-background/80 backdrop-blur-md">
            <div className="flex items-center justify-between px-6 py-4 gap-4">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-muted-foreground
                                            hover:text-foreground" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {greeting}{doctorName ? `, Dr. ${doctorName.split(' ')[0]}` : ""}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    {new Date().toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <Button
                onClick={() => setIsNewScanOpen(true)}
                className="bg-primary text-primary-foreground
                           hover:bg-primary/90 shadow-md shadow-primary/20"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Scan
              </Button>
            </div>
          </header>

          <main className="flex-1 px-6 py-6 space-y-6 w-full">

            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Patients"
                value={stats.totalPatients}
                icon={Users}
                color="bg-blue-500/10 text-blue-400"
              />
              <StatCard
                label="Scans This Month"
                value={stats.scansThisMonth}
                icon={ScanLine}
                color="bg-green-500/10 text-green-400"
              />
              <StatCard
                label="High Risk (TR4/TR5)"
                value={stats.highRiskCount}
                icon={ShieldAlert}
                color="bg-orange-500/10 text-orange-400"
                sub="Require close monitoring"
              />
              <StatCard
                label="Overdue Follow-ups"
                value={stats.overdueCount}
                icon={Bell}
                color={stats.overdueCount > 0
                  ? "bg-red-500/10 text-red-400"
                  : "bg-muted text-muted-foreground"
                }
                sub={stats.overdueCount > 0 ? "Action required" : "All on track"}
              />
            </div>

            {/* ── Search + filters ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">

                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2
                                      w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name or report ID (TV-TR4-...)"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9 h-10 bg-card border-border/60"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => handleSearchChange("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2
                                  text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className={`h-10 gap-2 border-border/60
                                   ${activeFiltersCount > 0
                                     ? 'border-primary text-primary'
                                     : ''}`}
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      Filter
                      {activeFiltersCount > 0 && (
                        <span className="ml-1 w-5 h-5 rounded-full bg-primary
                                          text-primary-foreground text-[10px]
                                          font-bold flex items-center justify-center">
                          {activeFiltersCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 bg-card border-border/60"
                  >
                    <p className="text-[10px] uppercase tracking-wider
                                   text-muted-foreground px-2 py-1.5">
                      TI-RADS Level
                    </p>
                    {[1, 2, 3, 4, 5].map((t) => (
                      <DropdownMenuItem
                        key={t}
                        onClick={() => setFilterTirads(
                          filterTirads === t ? null : t
                        )}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <span>TR{t}</span>
                        {filterTirads === t && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setFilterOverdue(!filterOverdue)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                        Overdue only
                      </span>
                      {filterOverdue && (
                        <span className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </DropdownMenuItem>
                    {activeFiltersCount > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setFilterTirads(null);
                            setFilterOverdue(false);
                          }}
                          className="text-muted-foreground cursor-pointer"
                        >
                          Clear all filters
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 gap-2 border-border/60"
                    >
                      {sortBy === "recent"  && <Clock3 className="w-4 h-4" />}
                      {sortBy === "name"    && <ArrowDownAZ className="w-4 h-4" />}
                      {sortBy === "tirads"  && <TrendingDown className="w-4 h-4" />}
                      {sortBy === "overdue" && <AlertCircle className="w-4 h-4" />}
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 bg-card border-border/60"
                  >
                    {[
                      { key: "recent",  label: "Most Recent",   icon: Clock3 },
                      { key: "name",    label: "Name A–Z",      icon: ArrowDownAZ },
                      { key: "tirads",  label: "TI-RADS (High)", icon: TrendingDown },
                      { key: "overdue", label: "Overdue First", icon: AlertCircle },
                    ].map(({ key, label, icon: Icon }) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setSortBy(key as any)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{label}</span>
                        {sortBy === key && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Active filter pills */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    Filters:
                  </span>
                  {filterTirads && (
                    <FilterPill
                      label={`TR${filterTirads}`}
                      onRemove={() => setFilterTirads(null)}
                    />
                  )}
                  {filterOverdue && (
                    <FilterPill
                      label="Overdue only"
                      onRemove={() => setFilterOverdue(false)}
                    />
                  )}
                </div>
              )}
            </div>

            {/* ── Patient list ── */}
            <div className="space-y-3">

              {/* List header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground
                                uppercase tracking-wider">
                  Patients
                  {!loading && (
                    <span className="ml-2 text-foreground font-bold">
                      {sortedPatients.length}
                    </span>
                  )}
                </h2>
              </div>

              {/* Rows */}
              {loading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : sortedPatients.length > 0 ? (
                <div className="space-y-2">
                  {sortedPatients.map((p) => (
                    <PatientCard key={p.id} patient={p} />
                  ))}
                </div>
              ) : (
                <EmptyState onAction={() => setIsNewScanOpen(true)} />
              )}
            </div>

          </main>
        </div>
      <NewScanPanel />
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center
                         justify-center">
          <div className="flex flex-col items-center gap-4">
            <span className="h-8 w-8 animate-spin rounded-full border-4
                              border-primary/30 border-t-primary" />
            <p className="text-muted-foreground font-medium">
              Loading Dashboard...
            </p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}