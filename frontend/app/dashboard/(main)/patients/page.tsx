// frontend/app/dashboard/(main)/patients/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Activity,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  FileText
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";

// Supabase DB Row Types
interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  dob: string | null;
  total_scans: number;
  next_followup_date: string | null;
  latest_scan_date: string | null;
  latest_tirads: number | null;
  latest_prediction_id: string | null;
  latest_report_id: string | null;
  is_overdue: boolean;
  total_count: number;
}

const supabase = createClient();

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
    month: "short", day: "numeric", year: "numeric"
  });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Main Page ────────────────────────────────────────────────
export default function PatientsPage() {
  const router = useRouter();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [reportId, setReportId] = useState("");
  const [tirads, setTirads] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");
  const [ageRange, setAgeRange] = useState<string>("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("last_scan");
  
  // Pagination State
  const limit = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data State
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    let ageMin: number | null = null;
    let ageMax: number | null = null;

    if (ageRange === "0-18") { ageMin = 0; ageMax = 18; }
    else if (ageRange === "19-40") { ageMin = 19; ageMax = 40; }
    else if (ageRange === "41-60") { ageMin = 41; ageMax = 60; }
    else if (ageRange === "60+") { ageMin = 61; ageMax = 150; }

    try {
      const { data, error } = await supabase.rpc("advanced_search_patients", {
        p_query: searchQuery || null,
        p_report_id: reportId || null,
        p_tirads: tirads !== "all" ? parseInt(tirads) : null,
        p_gender: gender !== "all" ? gender : null,
        p_age_min: ageMin,
        p_age_max: ageMax,
        p_start_date: null,
        p_end_date: null,
        p_overdue: overdueOnly,
        p_sort_by: sortBy,
        p_limit: limit,
        p_offset: (currentPage - 1) * limit
      });

      if (error) {
        console.error("Error fetching patients:", error.message);
        // Fallback UI or silent fail, maybe DB is missing the RPC temporarily
      } else {
        setPatients(data || []);
        if (data && data.length > 0) {
          setTotalCount(data[0].total_count);
        } else {
          setTotalCount(0);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, reportId, tirads, gender, ageRange, overdueOnly, sortBy, currentPage]);

  // Debounce fetching
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPatients();
    }, 400);
    return () => clearTimeout(handler);
  }, [fetchPatients]);

  // Pagination Handlers
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 1));

  return (
    <div className="flex-1 overflow-x-hidden pt-12 md:pt-0 selection:bg-primary/30">
      <div className="w-full p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-3 mb-6">
          <SidebarTrigger className="md:hidden" />
          <div>
                <h1 className="text-2xl font-bold text-foreground">Patient Directory</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse and filter all registered patients and their scans.
                </p>
              </div>
            </div>

            {/* ── Filters Section ───────────────────────────────────── */}
            <Card className="p-4 mb-6 border-border bg-card shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by patient name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 font-mono text-sm"
                    placeholder="Search by Report ID (e.g. TV-TR4...)"
                    value={reportId}
                    onChange={(e) => {
                      setReportId(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <Select value={tirads} onValueChange={(val) => { setTirads(val); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[130px] h-9 text-xs">
                      <SelectValue placeholder="TI-RADS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="1">TR1 (Benign)</SelectItem>
                      <SelectItem value="2">TR2 (Not Suspiscous)</SelectItem>
                      <SelectItem value="3">TR3 (Mildly Susp.)</SelectItem>
                      <SelectItem value="4">TR4 (Mod. Susp.)</SelectItem>
                      <SelectItem value="5">TR5 (Highly Susp.)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={gender} onValueChange={(val) => { setGender(val); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[110px] h-9 text-xs">
                      <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={ageRange} onValueChange={(val) => { setAgeRange(val); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[120px] h-9 text-xs">
                      <SelectValue placeholder="Age Range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Ages</SelectItem>
                      <SelectItem value="0-18">0 - 18 yrs</SelectItem>
                      <SelectItem value="19-40">19 - 40 yrs</SelectItem>
                      <SelectItem value="41-60">41 - 60 yrs</SelectItem>
                      <SelectItem value="60+">60+ yrs</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={sortBy} onValueChange={(val) => { setSortBy(val); setCurrentPage(1); }}>
                    <SelectTrigger className="w-[140px] h-9 text-xs ml-auto">
                      <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-3 w-3" />
                        <SelectValue placeholder="Sort By" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_scan">Latest Scan Date</SelectItem>
                      <SelectItem value="name">Patient Name (A-Z)</SelectItem>
                      <SelectItem value="overdue">Overdue First</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button 
                    variant={overdueOnly ? "default" : "outline"}
                    size="sm"
                    className={`h-9 px-3 text-xs gap-1.5 ${overdueOnly ? "bg-red-500 hover:bg-red-600 text-white border-transparent" : "text-muted-foreground"}`}
                    onClick={() => { setOverdueOnly(!overdueOnly); setCurrentPage(1); }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Overdue Only
                  </Button>
                </div>
              </div>
            </Card>

            {/* ── Patient List Table ─────────────────────────────────── */}
            <Card className="border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border font-semibold">
                    <tr>
                      <th className="px-6 py-4">Patient Name</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 hidden sm:table-cell">Latest Scan</th>
                      <th className="px-6 py-4 hidden lg:table-cell">Latest Report ID</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      // Skeleton loader
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                          <td className="px-6 py-4 hidden sm:table-cell"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-6 py-4 hidden lg:table-cell"><Skeleton className="h-4 w-28" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                        </tr>
                      ))
                    ) : patients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          <User className="h-8 w-8 mx-auto mb-3 opacity-20" />
                          <p>No patients found matching your filters.</p>
                          <Button 
                            variant="link" 
                            onClick={() => {
                              setSearchQuery("");
                              setReportId("");
                              setTirads("all");
                              setGender("all");
                              setAgeRange("all");
                              setOverdueOnly(false);
                              setSortBy("last_scan");
                            }}
                          >
                            Clear filters
                          </Button>
                        </td>
                      </tr>
                    ) : (
                      patients.map((patient) => {
                        const daysToFollowUp = daysUntil(patient.next_followup_date);
                        
                        return (
                          <tr 
                            key={patient.id} 
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => router.push(`/dashboard/patients/${patient.id}`)}
                          >
                            <td className="px-6 py-3">
                              <div className="font-medium text-foreground">
                                {patient.first_name} {patient.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground flex gap-1.5 items-center mt-0.5">
                                <span>{patient.age}y</span>
                                <span className="opacity-50">•</span>
                                <span>{patient.gender || "Unknown"}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3">
                              {patient.is_overdue ? (
                                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 gap-1 font-semibold text-[10px]">
                                  <AlertTriangle className="h-3 w-3" /> Overdue
                                </Badge>
                              ) : patient.latest_tirads ? (
                                <Badge variant="outline" className={`${getTiradsColorClass(patient.latest_tirads)} font-semibold text-[10px]`}>
                                  TR{patient.latest_tirads}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground text-[10px]">No Scans</Badge>
                              )}
                            </td>
                            <td className="px-6 py-3 hidden sm:table-cell">
                              {patient.latest_scan_date ? (
                                <div className="text-foreground text-sm">
                                  {formatDate(patient.latest_scan_date)}
                                </div>
                              ) : (
                                <div className="text-muted-foreground text-xs">—</div>
                              )}
                            </td>
                            <td className="px-6 py-3 hidden lg:table-cell">
                              {patient.latest_report_id ? (
                                <span className="font-mono text-xs text-muted-foreground">{patient.latest_report_id}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 text-xs font-medium"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/dashboard/patients/${patient.id}`);
                                }}
                              >
                                View Profile
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ── */}
              {totalCount > 0 && (
                <div className="px-6 py-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Showing <span className="font-medium text-foreground">{(currentPage - 1) * limit + 1}</span> to{" "}
                    <span className="font-medium text-foreground">{Math.min(currentPage * limit, totalCount)}</span> of{" "}
                    <span className="font-medium text-foreground">{totalCount}</span> results
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={handlePrev}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      onClick={handleNext}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
            
      </div>
    </div>
  );
}
