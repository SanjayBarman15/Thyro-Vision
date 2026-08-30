// frontend/components/analysis/diagnostic-assistant.tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  ChevronRight,
  Send,
  Pin,
  PinOff,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import SimulationBlock from "./simulation-block";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createClient } from "@/utils/supabase/client";
import ReasoningTheater, { ThinkingStep } from "./reasoning-theater";
import FeatureSimPanel from "./feature-sim-panel";

// ── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  simulationData?: any;
  structuredData?: any;
  completedFields?: string[];
  /** Live reasoning steps for this message */
  thinkingSteps?: Map<number, ThinkingStep>;
  totalSteps?: number;
}

interface DiagnosticAssistantProps {
  predictionId: string;
  tiradsLevel?: number;
  initialContext?: any;
  onPinChange?: (pinned: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractFeatureValues(initialContext: any): Record<string, string> {
  if (!initialContext) return {};
  const cf = initialContext?.features?.clinical_features ?? initialContext?.clinical_features ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(cf as any)) {
    if (v && typeof v === "object" && "value" in (v as any)) {
      // normalise to underscore form
      out[k] = String((v as any).value).toLowerCase().replace(/ /g, "_");
    }
  }
  return out;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DiagnosticAssistant({
  predictionId,
  tiradsLevel,
  initialContext,
  onPinChange,
}: DiagnosticAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    onPinChange?.(next);
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hello, I am **Clinera**, your Diagnostic Assistant. I have analysed this scan and confirmed it is **TR${tiradsLevel}**.

How can I assist you? I can explain the scoring rationale, run **What-If simulations**, or analyse a custom feature set using the simulator below.`,
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const prefillFeatures = extractFeatureValues(initialContext);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // ── Core send handler ────────────────────────────────────────────────────

  const handleSendMessage = async (
    e?: React.FormEvent,
    customMsg?: string,
    featuresInput?: Record<string, string>
  ) => {
    e?.preventDefault();
    const msg = customMsg || input;
    if (!msg.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Create empty assistant message shell
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      structuredData: {},
      completedFields: [],
      thinkingSteps: new Map(),
      totalSteps: 0,
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const body: any = {
        message: msg,
      };
      if (featuresInput && Object.keys(featuresInput).length > 0) {
        body.features_input = featuresInput;
      } else {
        body.prediction_id = predictionId;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/explain/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) throw new Error("Failed to connect to assistant");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let currentField = "";

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;
          const payload = line.replace("data: ", "").trim();

          // ── [THINKING_STEP] — reasoning theater ──────────────────────────
          if (payload.startsWith("[THINKING_STEP]:")) {
            try {
              const stepData: ThinkingStep = JSON.parse(
                payload.replace("[THINKING_STEP]:", "")
              );
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last.id !== assistantMsgId) return prev;
                const newSteps = new Map(last.thinkingSteps ?? new Map());
                newSteps.set(stepData.step, stepData);
                return [
                  ...prev.slice(0, -1),
                  { ...last, thinkingSteps: newSteps, totalSteps: stepData.total },
                ];
              });
              continue;
            } catch (err) {
              console.error("ThinkingStep parse error", err);
            }
          }

          // ── [HEADER_INIT] ─────────────────────────────────────────────────
          if (payload.startsWith("[HEADER_INIT]")) {
            try {
              const metadata = JSON.parse(payload.replace("[HEADER_INIT]", ""));
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                return [
                  ...prev.slice(0, -1),
                  { ...last, structuredData: { ...last.structuredData, metadata } },
                ];
              });
              continue;
            } catch (e) {
              console.error("Metadata parse error", e);
            }
          }

          // ── [FIELD_START] ─────────────────────────────────────────────────
          if (payload.startsWith("[FIELD_START]:")) {
            currentField = payload.replace("[FIELD_START]:", "");
            continue;
          }

          // ── [FIELD_VALUE] ─────────────────────────────────────────────────
          if (payload.startsWith("[FIELD_VALUE]:")) {
            const val = payload.replace("[FIELD_VALUE]:", "");
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              const existingVal = last.structuredData?.[currentField];
              let newVal;
              if (val.startsWith("{") || val.startsWith("[")) {
                try {
                  newVal = JSON.parse(val);
                } catch {
                  newVal = val;
                }
              } else {
                newVal = (existingVal || "") + val;
              }
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  structuredData: { ...last.structuredData, [currentField]: newVal },
                },
              ];
            });
            continue;
          }

          // ── [FIELD_DONE] ──────────────────────────────────────────────────
          if (payload.startsWith("[FIELD_DONE]:")) {
            const doneField = payload.replace("[FIELD_DONE]:", "");
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  completedFields: [...(last.completedFields || []), doneField],
                },
              ];
            });
            continue;
          }

          // Fallback legacy text
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last.id === assistantMsgId) {
              return [...prev.slice(0, -1), { ...last, content: last.content + payload }];
            }
            return prev;
          });
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: "error",
          role: "assistant",
          content: "⚠️ Connection lost. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeatureSimRun = (features: Record<string, string>, message: string) => {
    handleSendMessage(undefined, message, features);
  };

  // ── Sub-components ────────────────────────────────────────────────────────

  const ClinicalHeader = ({ metadata }: { metadata: any }) => (
    <div className="flex items-center gap-2 mb-3 py-1.5 px-3 rounded-lg bg-background/50 border border-border/50 text-[10px] uppercase font-bold tracking-tight w-full">
      <div className="flex items-center gap-1.5 text-primary border-r border-border pr-2">
        <ShieldCheck className="w-3 h-3" />
        <span>TR-{metadata.tirads_level || "?"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground border-r border-border px-2">
        <span>CONF: {metadata.confidence_score?.toFixed(2) || "0.00"}</span>
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground pl-1">
        <span className="opacity-60">{metadata.model_version || "Clinera-v2"}</span>
      </div>
    </div>
  );

  const StructuredReport = ({ msg }: { msg: Message }) => {
    const data = msg.structuredData;
    const completed = msg.completedFields || [];

    return (
      <div
        className="flex flex-col gap-4 w-full break-words clinical-report"
        style={{ contain: "layout" }}
      >
        {/* Metadata Header */}
        {data.metadata ? (
          <ClinicalHeader metadata={data.metadata} />
        ) : (
          <div className="h-8 w-full bg-muted/30 animate-pulse rounded-lg" />
        )}

        {/* Rationale */}
        {completed.includes("rationale") ? (
          <section className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center gap-2 text-primary font-bold text-xs border-b border-primary/10 pb-1 uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>Clinical Rationale</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {data.rationale}
            </p>
          </section>
        ) : data.metadata ? (
          <div className="space-y-2 opacity-50">
            <div className="h-3 w-48 bg-muted animate-pulse rounded" />
            <div className="h-12 w-full bg-muted/20 animate-pulse rounded" />
          </div>
        ) : null}

        {/* Scoring Table */}
        {completed.includes("scoring_breakdown") ? (
          <section className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="flex items-center gap-2 text-primary font-bold text-xs border-b border-primary/10 pb-1 uppercase tracking-wider">
              <AlertCircle className="w-3 h-3" />
              <span>Scoring Breakdown</span>
            </div>
            <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
              <table className="w-full text-[10px] text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[8px] font-bold">
                  <tr>
                    <th className="px-2 py-1.5">Feature</th>
                    <th className="px-2 py-1.5">Finding</th>
                    <th className="px-2 py-1.5 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.scoring_breakdown?.map((item: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/10">
                      <td className="px-2 py-1.5 font-medium capitalize">
                        {item.feature.replace(/_/g, " ")}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{item.value}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-primary">+{item.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : completed.includes("rationale") ? (
          <div className="h-32 w-full bg-muted/10 animate-pulse rounded-lg border border-border/20" />
        ) : null}

        {/* Simulation Delta */}
        {completed.includes("simulation_impact") && data.simulation_impact && (
          <section className="space-y-2 p-3 rounded-xl border border-primary/30 bg-primary/5 animate-in zoom-in-95 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest">
              <RotateCcw className="w-3 h-3" />
              <span>Simulated Delta</span>
            </div>
            <div className="flex items-baseline justify-between py-1 border-b border-primary/10">
              <span className="text-[9px] text-muted-foreground uppercase">Point Shift</span>
              <span className="text-sm font-black text-primary">
                {data.simulation_impact.original?.points} → {data.simulation_impact.modified?.points}
              </span>
            </div>
            <div className="flex items-baseline justify-between pb-1 border-b border-primary/10">
              <span className="text-[9px] text-muted-foreground uppercase">TR Level</span>
              <span className="text-sm font-black text-primary">
                TR{data.simulation_impact.original?.tirads} → TR{data.simulation_impact.modified?.tirads}
              </span>
            </div>
            <p className="text-[11px] leading-snug italic text-foreground/70 pt-1">
              &ldquo;{data.simulation_impact.delta?.clinical_implication}&rdquo;
            </p>
          </section>
        )}

        {/* Guideline Reference */}
        {completed.includes("guideline_reference") && (
          <section className="pt-2 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground leading-tight italic">
              {data.guideline_reference}
            </p>
          </section>
        )}
      </div>
    );
  };

  const smartSuggestions = [
    "Explain TR category logic",
    "What are my follow-up options?",
    "Show ACR size thresholds",
    "What if margin changes to extra-thyroidal extension?",
    "What if echogenicity is very hypoechoic?",
  ];

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full z-50 flex transition-all duration-300",
        isPinned ? "z-40" : "z-50"
      )}
    >
      {/* Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute left-[-60px] top-1/2 -translate-y-1/2"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsOpen(true)}
              className="w-12 h-12 rounded-full shadow-2xl bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
            >
              <Bot className="w-6 h-6 animate-pulse" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: isOpen ? 420 : 0 }}
        className={cn(
          "bg-card border-l border-border flex flex-col overflow-hidden shadow-2xl relative",
          !isOpen && "border-none"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Clinera Assistant</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                Thyroid Diagnostic Copilot
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8" onClick={togglePin}>
                    {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isPinned ? "Unpin" : "Pin to sidebar"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              onClick={() => {
                setIsOpen(false);
                if (isPinned) {
                  setIsPinned(false);
                  onPinChange?.(false);
                }
              }}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Context Banner */}
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] font-medium text-primary">
            <Sparkles className="w-3 h-3" />
            <span>Analysing TR{tiradsLevel} scan</span>
          </div>
          <Badge
            variant="outline"
            className="bg-background/50 text-[10px] uppercase font-bold text-primary border-primary/20"
          >
            ACR-2017 Grounded
          </Badge>
        </div>

        {/* Chat Area */}
        <ScrollArea className="flex-1 h-0 w-full" ref={scrollRef}>
          <div className="p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[92%] gap-1",
                  msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                {/* Reasoning Theater — appears above the message bubble while thinking */}
                {msg.role === "assistant" &&
                  msg.thinkingSteps &&
                  msg.thinkingSteps.size > 0 && (
                    <ReasoningTheater
                      steps={msg.thinkingSteps}
                      totalSteps={msg.totalSteps ?? 0}
                      className="w-full mb-1"
                    />
                  )}

                {/* Message bubble — only show once we have real content */}
                {(msg.content ||
                  (msg.structuredData && Object.keys(msg.structuredData).length > 0)) && (
                  <div
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed w-full",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted/80 text-foreground border border-border/50 rounded-tl-none"
                    )}
                  >
                    {msg.structuredData && Object.keys(msg.structuredData).length > 0 ? (
                      <StructuredReport msg={msg} />
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown
                          components={{
                            h3: ({ node, ...props }) => (
                              <h3
                                className="text-base font-bold text-primary mt-4 mb-2 flex items-center gap-2 border-b border-primary/20 pb-1"
                                {...props}
                              />
                            ),
                            h4: ({ node, ...props }) => (
                              <h4
                                className="text-sm font-semibold text-foreground/90 mt-3 mb-1"
                                {...props}
                              />
                            ),
                            strong: ({ node, ...props }) => (
                              <span className="font-bold text-primary" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                              <p
                                className="mb-3 last:mb-0 leading-relaxed text-foreground/90"
                                {...props}
                              />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="space-y-1 mb-3" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                              <li
                                className="list-disc list-inside text-xs text-muted-foreground ml-2"
                                {...props}
                              />
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                )}

                {msg.role === "assistant" && (
                  <span className="text-[10px] text-muted-foreground ml-2">Verified Output</span>
                )}
              </div>
            ))}

            {/* Global loading indicator (before any step events arrive) */}
            {isLoading &&
              messages[messages.length - 1]?.thinkingSteps?.size === 0 && (
                <div className="flex items-center gap-2 text-muted-foreground animate-pulse text-xs italic ml-2">
                  <Bot className="w-3 h-3" /> Clinera is initialising analysis…
                </div>
              )}
          </div>
        </ScrollArea>

        {/* Bottom panel: Feature Sim + Suggestions + Input */}
        <div className="p-4 border-t border-border space-y-3 bg-background/50">
          {/* Feature Simulator Panel */}
          <FeatureSimPanel
            prefillFeatures={prefillFeatures}
            onRunSimulation={handleFeatureSimRun}
            isLoading={isLoading}
          />

          {/* Smart Suggestions */}
          {messages.length < 3 && !isLoading && (
            <div className="flex flex-wrap gap-1.5">
              {smartSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSendMessage(undefined, s)}
                  className="text-[10px] font-medium px-2.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this analysis or run a what-if…"
              className="bg-muted/30 border-border/50 focus-visible:ring-primary/20"
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <Button
              size="icon"
              onClick={() => handleSendMessage()}
              disabled={isLoading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Fixed Recommendation Banner */}
        <div className="px-4 py-3 bg-card border-t border-border shrink-0">
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 flex gap-3">
            <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
            <div>
              <h4 className="text-[11px] font-bold text-yellow-600 uppercase">
                ACR-TIRADS 2017 Recommendation
              </h4>
              <p className="text-[10px] text-muted-foreground leading-tight mt-1">
                Based on current TR{tiradsLevel} level. Verify measurements to determine if FNA or
                follow-up is mandatory.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
