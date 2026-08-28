"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  CheckCircle2,
  XCircle,
  FlaskConical,
  X,
  AlertTriangle,
} from "lucide-react";

const DEMO_EMAIL = "dummy@thyrovision.ai";
const STORAGE_KEY = "thyrovision_demo_popup_dismissed";

const WORKING_FEATURES = [
  "TI-RADS categorisation display (pre-loaded demo data)",
  "Follow-up scheduling & tracking",
  "Dashboard statistics and overview",
  "Profile settings",
];

const NOT_WORKING_FEATURES = [
  "Patient registration & management (no inference = no value)",
  "Scan upload and new scan processing pipeline",
  "Live AI thyroid nodule analysis (backend not deployed)",
  "Grad-CAM heatmap generation",
  "Real-time confidence score inference",
  "Report export / PDF generation",
  "Clinera AI diagnostic chat",
  "Email / notification delivery",
];

export default function DemoAccountPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === DEMO_EMAIL) setVisible(true);
    };
    check();
  }, []);

  // Lock body scroll when visible
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center overflow-hidden"
      style={{ padding: "clamp(12px, 3vw, 24px)", background: "rgba(0, 0, 0, 0.65)" }}
      onClick={dismiss}
    >
      {/* Glassmorphism card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl no-scrollbar"
        style={{
          maxHeight: "min(90vh, 700px)",
          background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
        }}
      >
        {/* gradient top line */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-2xl"
          style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), rgba(56,189,248,0.6), transparent)" }}
        />

        {/* subtle inner glow blobs */}
        <div
          className="absolute -top-16 -left-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)", filter: "blur(20px)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)", filter: "blur(20px)" }}
        />

        {/* close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        >
          <X className="w-3.5 h-3.5 text-white/70" />
        </button>

        <div className="relative z-10 p-7">
          {/* header */}
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(16,185,129,0.25), rgba(16,185,129,0.08))",
                border: "1px solid rgba(16,185,129,0.35)",
                boxShadow: "0 0 20px rgba(16,185,129,0.15)",
              }}
            >
              <FlaskConical className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-base font-bold text-white">Demo Account</h2>
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full tracking-widest"
                  style={{
                    background: "rgba(251,191,36,0.15)",
                    border: "1px solid rgba(251,191,36,0.3)",
                    color: "rgb(251,191,36)",
                  }}
                >
                  DEMO
                </span>
              </div>
              {/* <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                You&apos;re logged in as{" "}
                <span className="text-emerald-400 font-medium">{DEMO_EMAIL}</span>.
                All records are{" "}
                <span className="text-white font-semibold">dummy data</span> — no real patient info is used.
              </p> */}
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                You are logged in as{" "}
                <span className="text-emerald-400 font-medium">
                  {DEMO_EMAIL}
                </span>
                . All patient records and scans shown are{" "}
                <span className="text-white font-medium">dummy data</span>—no
                real patient information is used. This account exists solely to
                showcase ThyroVision's capabilities.
              </p>
            </div>
          </div>

          {/* amber notice */}
          <div
            className="flex items-start gap-3 rounded-xl p-3.5 mb-5"
            style={{
              background: "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06))",
              border: "1px solid rgba(245,158,11,0.25)",
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "rgb(251,191,36)" }} />
            <p className="text-xs leading-relaxed" style={{ color: "rgba(251,191,36,0.85)" }}>
              The{" "}
              <span className="font-semibold text-amber-300">backend AI inference server</span>{" "}
              is not yet deployed. Features requiring it will not function.
            </p>
          </div>

          {/* feature grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* working */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(16,185,129,0.06)",
                border: "1px solid rgba(16,185,129,0.15)",
              }}
            >
              <p
                className="text-[9px] uppercase tracking-widest font-bold mb-3"
                style={{ color: "rgba(52,211,153,0.9)" }}
              >
                ✓ Working
              </p>
              <ul className="space-y-2">
                {WORKING_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* not working */}
            <div
              className="rounded-xl p-4"
              style={{
                background: "rgba(239,68,68,0.05)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <p
                className="text-[9px] uppercase tracking-widest font-bold mb-3"
                style={{ color: "rgba(252,165,165,0.9)" }}
              >
                ✗ Unavailable
              </p>
              <ul className="space-y-2">
                {NOT_WORKING_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-snug" style={{ color: "rgba(255,255,255,0.5)" }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* dismiss button */}
          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,0.9), rgba(20,184,166,0.9))",
              boxShadow: "0 4px 24px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
              border: "1px solid rgba(16,185,129,0.5)",
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 6px 32px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)")}
          >
            Got it — Explore the Demo
          </button>
        </div>
      </div>
    </div>
  );
}
