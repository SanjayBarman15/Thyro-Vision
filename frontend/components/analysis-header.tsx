"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  User,
  Calendar,
  Hash,
  LogOut,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { signout } from "@/app/login/actions";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import { goeyToast as toast } from "@/components/ui/goey-toaster";

interface HeaderProps {
  patientName?: string;
  scanDate?: string;
  predictionId?: string;
  reportId?: string;
}

export default function AnalysisHeader({
  patientName,
  scanDate,
  predictionId,
  reportId,
}: HeaderProps) {
  const [isExporting, setIsExporting] = useState(false);
  const supabase = createClient();

  const handleExportPDF = async () => {
    if (!predictionId) return;

    try {
      setIsExporting(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        toast.error("Session expired. Please login again.");
        return;
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/export/pdf/${predictionId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportId || `Report_${predictionId}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to download report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="border-b border-border/60 bg-card/50 backdrop-blur-md px-6 py-3 flex items-center justify-between z-30">
      <div className="flex items-center gap-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="gap-2 group">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden md:inline">Dashboard</span>
          </Button>
        </Link>
        <div className="h-6 w-px bg-border mx-2 hidden md:block" />
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
          {patientName && (
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-primary" />
              <span>{patientName}</span>
            </div>
          )}
          {scanDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
              <Calendar className="h-3 w-3" />
              <span>Scan: {scanDate}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="sm"
            disabled={isExporting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 rounded-full px-5 shadow-lg shadow-primary/20 disabled:opacity-70 transition-all"
            onClick={handleExportPDF}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>{isExporting ? "Generating..." : "Export PDF"}</span>
          </Button>
      </div>
    </header>
  );
}
