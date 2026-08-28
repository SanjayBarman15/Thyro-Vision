"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Upload,
  Search,
  Brain,
  ClipboardCheck,
  FileText,
  ChevronRight,
  ArrowLeft,
  Shield,
  Zap,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Footer } from "@/components/footer";
import { NavHeader } from "@/components/nav-header";
import { useMotionValue, useSpring, useTransform, useScroll } from "framer-motion";

function TiltWrapper({ children }: { children: React.ReactNode }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseY = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXPos = event.clientX - rect.left;
    const mouseYPos = event.clientY - rect.top;
    const xPct = mouseXPos / width - 0.5;
    const yPct = mouseYPos / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className="relative w-full h-full"
    >
      <div style={{ transform: "translateZ(50px)" }}>{children}</div>
    </motion.div>
  );
}

const steps = [
  {
    icon: Upload,
    title: "Secure Data Ingestion",
    subtitle: " DICOM & Image Processing",
    description:
      "Your ultrasound images are securely uploaded and pre-processed. We handle standard image formats and DICOM files, ensuring high-fidelity data preservation for analysis.",
    details: [
      "End-to-end encrypted transfer",
      "Metadata extraction for clinical context",
      "Automated image normalization",
    ],
    color: {
      text: "text-blue-400",
      bg: "bg-blue-500/10",
      bgHover: "group-hover:bg-blue-500/20",
      border: "group-hover:border-blue-500/40",
      dot: "bg-blue-500",
    },
  },
  {
    icon: Search,
    title: "Region of Interest (ROI) Detection",
    subtitle: "Advanced Vision AI Localization",
    description:
      "Our first AI layer uses advanced computer vision techniques to scan the entire ultrasound frame and precisely localize thyroid nodules with high-confidence spatial mapping for downstream analysis.",
    details: [
      "Automated nodule localization",
      "Multi-nodule detection capability",
      "Spatial coordinate mapping",
    ],
    color: {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
      bgHover: "group-hover:bg-emerald-500/20",
      border: "group-hover:border-emerald-500/40",
      dot: "bg-emerald-500",
    },
  },
  {
    icon: Brain,
    title: "Deep Feature Characterization",
    subtitle: "Multi-Layer Diagnostic Intelligence",
    description:
      "A specialized AI system analyzes detected regions to classify critical thyroid characteristics including composition, echogenicity, shape, margins, and calcification patterns.",
    details: [
      "Advanced texture analysis",
      "Feature-specific neural weights",
      "Sub-millimeter pattern recognition",
    ],
    color: {
      text: "text-indigo-400",
      bg: "bg-indigo-500/10",
      bgHover: "group-hover:bg-indigo-500/20",
      border: "group-hover:border-indigo-500/40",
      dot: "bg-indigo-500",
    },
  },
  {
    icon: Layers,
    title: "TI-RADS Rule Engine",
    subtitle: "ACR Standardized Risk Stratification",
    description:
      "The AI's feature predictions are fed into a deterministic TI-RADS engine that calculates risk points according to official ACR guidelines, ensuring clinical grounding.",
    details: [
      "Objective point calculation",
      "Standardized TR1-TR5 classification",
      "Rule-based medical alignment",
    ],
    color: {
      text: "text-orange-400",
      bg: "bg-orange-500/10",
      bgHover: "group-hover:bg-orange-500/20",
      border: "group-hover:border-orange-500/40",
      dot: "bg-orange-500",
    },
  },
  {
    icon: Zap,
    title: "Explainable AI (Grad-CAM)",
    subtitle: "Decision Transparency",
    description:
      "We don't just give you a result. Our Grad-CAM (Gradient-weighted Class Activation Mapping) technology generates heatmaps showing exactly which visual cues influenced the AI's decision.",
    details: [
      "Visual evidence mapping",
      "Decision confidence metrics",
      "Anatomical feature validation",
    ],
    color: {
      text: "text-rose-400",
      bg: "bg-rose-500/10",
      bgHover: "group-hover:bg-rose-500/20",
      border: "group-hover:border-rose-500/40",
      dot: "bg-rose-500",
    },
  },
  {
    icon: ClipboardCheck,
    title: "Generative Medical Summary",
    subtitle: "Gemini AI Large Language Model",
    description:
      "A sophisticated LLM synthesizes technical findings into a concise, professional medical summary, providing reasoning that bridges AI predictions with clinical intuition.",
    details: [
      "Human-readable logical summaries",
      "Cross-referenced feature analysis",
      "Simplified clinical takeaways",
    ],
    color: {
      text: "text-violet-400",
      bg: "bg-violet-500/10",
      bgHover: "group-hover:bg-violet-500/20",
      border: "group-hover:border-violet-500/40",
      dot: "bg-violet-500",
    },
  },
  {
    icon: FileText,
    title: "Clinical Documentation",
    subtitle: "Professional Export",
    description:
      "The final step is the generation of a comprehensive, hospital-ready PDF report containing all measurements, heatmaps, AI findings, and space for final doctor verification.",
    details: [
      "One-click report generation",
      "Archivatable PDF format",
      "Standardized clinical structure",
    ],
    color: {
      text: "text-cyan-400",
      bg: "bg-cyan-500/10",
      bgHover: "group-hover:bg-cyan-500/20",
      border: "group-hover:border-cyan-500/40",
      dot: "bg-cyan-500",
    },
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export default function HowItWorksPage() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  const scaleY = useSpring(scrollYProgress, {
    stiffness: 40,
    damping: 25,
    restDelta: 0.001,
  });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <AuroraBackground />
      <ParticleBackground />

      <NavHeader />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto px-6 py-20 pb-40">
        {/* Intro Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-24 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
            <Shield className="h-3 w-3" />
            EVIDENCE-BASED AI
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-foreground to-foreground/50">
            How ThyroVision Works
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Our multi-stage AI pipeline combines state-of-the-art computer
            vision with clinical rule engines to provide radiologists with a
            transparent, evidence-based second opinion.
          </p>
        </motion.div>

        {/* Steps Journey */}
        <motion.div
          ref={containerRef}
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="relative space-y-32"
        >
          {/* Vertical Scroll Progress Line */}
          <div className="absolute left-1/2 -translate-x-1/2 top-10 bottom-10 w-1 bg-border/20 hidden md:block rounded-full">
            <motion.div
              className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-b from-blue-500 via-indigo-500 to-emerald-500 rounded-full origin-top"
              style={{ scaleY }}
            />
          </div>

          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isEven = idx % 2 === 0;

            return (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className={`relative flex flex-col md:flex-row gap-12 items-center ${isEven ? "md:flex-row" : "md:flex-row-reverse"}`}
              >
                {/* Visual Side */}
                <div className="flex-1 w-full perspective-1000">
                  <TiltWrapper>
                    <div
                      className={`relative group aspect-square max-w-sm mx-auto flex items-center justify-center`}
                    >
                      <div
                        className={`absolute inset-0 ${step.color.bg} blur-3xl ${step.color.bgHover} transition-all duration-500 rounded-full`}
                      />
                      <div
                        className={`relative w-48 h-48 rounded-3xl bg-card border border-border/50 flex items-center justify-center shadow-2xl ${step.color.border} transition-all duration-500`}
                      >
                        <Icon
                          className={`h-20 w-20 ${step.color.text} group-hover:animate-pulse`}
                          strokeWidth={1.5}
                        />
                        <div className="absolute -bottom-4 -right-4 w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-xl">
                          {idx + 1}
                        </div>
                      </div>
                    </div>
                  </TiltWrapper>
                </div>

                {/* Animated Central Indicator Dot */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center justify-center z-20 pointer-events-none">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0.3 }}
                    whileInView={{ scale: 1.15, opacity: 1 }}
                    viewport={{ once: false, margin: "-45% 0px -45% 0px" }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="relative flex items-center justify-center"
                  >
                    {/* Pulsing ring background */}
                    <motion.div
                      animate={{ scale: [1, 1.4, 1] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                      className={`absolute -inset-2 rounded-full ${step.color.bg} opacity-50 blur-xs`}
                    />
                    
                    {/* Ring Container */}
                    <div className={`relative h-6 w-6 rounded-full bg-background border-2 ${step.color.border.replace("group-hover:", "") || "border-border"} flex items-center justify-center shadow-lg`}>
                      {/* Inner Active Center */}
                      <div className={`h-2 w-2 rounded-full ${step.color.dot}`} />
                    </div>
                  </motion.div>
                </div>

                {/* Content Side */}
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <span
                      className={`${step.color.text} text-sm font-bold tracking-widest uppercase`}
                    >
                      Step {idx + 1}: {step.subtitle}
                    </span>
                    <h2 className="text-3xl font-bold tracking-tight">
                      {step.title}
                    </h2>
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-lg">
                    {step.description}
                  </p>
                  <ul className="grid gap-3">
                    {step.details.map((detail, dIdx) => (
                      <li
                        key={dIdx}
                        className="flex items-center gap-3 text-sm font-medium text-foreground/80"
                      >
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${step.color.dot}`}
                        />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-40 text-center p-12 rounded-4xl bg-linear-to-b from-card/30 to-background border border-border/50 backdrop-blur-sm"
        >
          <h2 className="text-3xl font-bold mb-6">
            Ready to Experience Precision?
          </h2>
          <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
            Join the medical professionals using AI to enhance their clinical
            workflow and diagnostic confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="h-14 px-8 rounded-2xl text-lg font-bold gap-2 group"
              >
                Register as Physician
                <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-8 rounded-2xl text-lg"
              >
                Talk to Team
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
