import { NavHeader } from "@/components/nav-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Brain,
  BarChart3,
  MessageSquare,
  Download,
  Lock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Footer } from "@/components/footer";
import { ParticleBackground } from "@/components/ParticleBackground";
import { AuroraBackground } from "@/components/AuroraBackground";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <AuroraBackground />
      <ParticleBackground />

      <div className="relative z-10 text-foreground">
        <NavHeader />

        {/* Hero Section */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 flex justify-center">
              <Badge
                variant="outline"
                className="border-primary/50 text-primary"
              >
                Clinical Decision Support
              </Badge>
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-tight text-foreground sm:text-6xl">
              AI-Assisted Thyroid Ultrasound Analysis
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              ThyroVision provides radiologists with AI-powered classification
              and localization assistance, keeping the doctor in control of
              every clinical decision.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-secondary text-secondary hover:bg-secondary/10 bg-transparent w-full sm:w-auto"
                >
                  How It Works
                </Button>
              </Link>
            </div>

            <div className="mt-24 mb-20 overflow-hidden rounded-2xl border border-border/50 bg-card/80 shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] transition-all hover:scale-[1.02] backdrop-blur-sm">
              <div className="aspect-video relative w-full overflow-hidden rounded-xl bg-muted">
                <Image
                  src="/landinghero.png"
                  alt="ThyroVision Product Interface Preview"
                  fill
                  className="object-fit"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Problem → Solution */}
        <section className="border-t border-border px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Why ThyroVision?
            </h2>
            <div className="grid gap-12 md:grid-cols-2">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-muted-foreground">
                  Clinical Challenges
                </h3>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <span className="text-secondary">•</span>
                    <span>
                      High inter-observer variability in TIRADS assessment
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-secondary">•</span>
                    <span>
                      Time-consuming manual analysis of nodule characteristics
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-secondary">•</span>
                    <span>
                      Need for consistent documentation and follow-up
                      recommendations
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-secondary">•</span>
                    <span>
                      Difficulty maintaining diagnostic accuracy under high
                      volume
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="mb-4 text-lg font-semibold text-primary">
                  ThyroVision Solutions
                </h3>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>
                      Automated nodule localization and characterization
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>
                      AI-assisted TIRADS classification with confidence scores
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>
                      Explainable AI that doctors can understand and verify
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>
                      Human-in-the-loop feedback system for continuous
                      improvement
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-border px-4 py-20 sm:px-6 lg:px-8 bg-card/40">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold">
              How It Works
            </h2>
            <div className="grid gap-6 md:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "Upload",
                  desc: "Upload ultrasound images",
                },
                {
                  step: "2",
                  title: "Analyze",
                  desc: "AI processes the images",
                },
                {
                  step: "3",
                  title: "Review",
                  desc: "Review AI predictions and explanation",
                },
                {
                  step: "4",
                  title: "Confirm",
                  desc: "Provide feedback and export report",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex flex-col items-center text-center"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {item.step}
                  </div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="border-t border-border px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-12 text-center text-3xl font-bold">
              Key Features
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: BarChart3,
                  title: "TIRADS Classification",
                  desc: "Automated risk stratification based on imaging characteristics",
                },
                {
                  icon: Brain,
                  title: "Confidence Scoring",
                  desc: "Transparent confidence metrics for each prediction",
                },
                {
                  icon: Lock,
                  title: "Nodule Localization",
                  desc: "Precise bounding boxes and anatomical positioning",
                },
                {
                  icon: MessageSquare,
                  title: "Human-in-the-Loop AI",
                  desc: "Doctor feedback improves model accuracy over time",
                },
                {
                  icon: Download,
                  title: "Clinical Reports",
                  desc: "Generate professional reports with AI insights",
                },
                {
                  icon: CheckCircle2,
                  title: "Explainable Results",
                  desc: "Understand why the AI made each prediction",
                },
              ].map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={feature.title}
                    className="border-border bg-card p-6"
                  >
                    <Icon className="mb-4 h-6 w-6 text-primary" />
                    <h3 className="mb-2 font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.desc}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-border px-4 py-20 sm:px-6 lg:px-8 bg-card/40">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-8 text-3xl font-bold">Medical-Grade Standards</h2>
            <div className="space-y-4 rounded-lg border border-border bg-card/50 p-8">
              <p className="text-lg font-semibold text-primary">
                AI-Assisted, Not AI-Replacing
              </p>
              <p className="text-muted-foreground">
                ThyroVision is designed as a clinical decision support tool. The
                radiologist retains full authority and responsibility for all
                clinical decisions. Our AI provides evidence-based
                recommendations, but doctors make the final call.
              </p>
              <p className="text-sm text-muted-foreground pt-4">
                ⚠️ Medical Disclaimer: ThyroVision is a research tool for
                clinical support purposes only and should not be used as a
                substitute for professional medical judgment.
              </p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
