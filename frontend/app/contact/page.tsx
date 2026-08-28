"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Github,
  Linkedin,
  Mail,
  Code2,
  Cpu,
  Globe,
  Layout,
  BrainCircuit,
  Bot,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuroraBackground } from "@/components/AuroraBackground";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Footer } from "@/components/footer";
import { NavHeader } from "@/components/nav-header";

// ─── Avatar component ─────────────────────────────────────────────────────────
function MemberAvatar({ src, name }: { src: string; name: string }) {
  return (
    <div className="relative w-[7.5rem] h-[7.5rem] rounded-2xl overflow-hidden border-2 border-primary/20 bg-muted shadow-inner group-hover:border-primary/50 transition-colors flex-shrink-0">
      <Image
        src={src || "/zedev/team_member_2_female_frontend_1772394913767.png"}
        alt={name}
        fill
        unoptimized
        className="object-cover"
      />
    </div>
  );
}

// ─── Team data ────────────────────────────────────────────────────────────────
const teamMembers = [
  {
    name: "Md Ayan Qurashi",
    role: "DevOps & Infrastructure",
    image: "/zedev/Ayan.png",
    icon: Cpu,
    bio: "Managed cloud infrastructure, deployment pipelines, and secure data flow for the production medical imaging system.",
    github: "https://github.com/ayan15888",
    linkedin: "https://www.linkedin.com/in/md-ayan-qurashi-3a426a24b/",
    email: "ayanqurashi10@gmail.com",
  },
  {
    name: "Sumitra Devi Bala Brahma",
    role: "Data & ML Researcher",
    image: "/zedev/sumitra.png",
    icon: Globe,
    bio: "Led dataset research, annotation strategy, and preprocessing. Also contributed to the TI-RADS rule-based risk engine for clinical alignment.",
    github: "http://github.com",
    linkedin: "https://www.linkedin.com/in/sumitra-d-325324224/",
    email: "sumibrahma76@gmail.com",
  },
  {
    name: "Arindam Chakraborty",
    role: "ML Developer — Detection System",
    image: "/zedev/Arindam.png",
    icon: Bot,
    bio: "Built and trained the detection system and handled data preparation for accurate nodule localization in ultrasound images.",
    github: "https://github.com/rajatarindam",
    linkedin: "https://www.linkedin.com/in/arindamichakraborty/",
    email: "rajatarindam@gmail.com",
  },
  {
    name: "Sanjay Barman",
    role: "System Architect & Developer",
    image: "/zedev/Sanjay.png",
    icon: Code2,
    bio: "Designed the full system architecture and developed the backend services, database schema, APIs, and frontend infrastructure.",
    github: "https://github.com/SanjayBarman15",
    linkedin: "https://www.linkedin.com/in/sanjay-barman15",
    email: "sanjaybarman5615@gmail.com",
  },
  {
    name: "Sneha Sharma",
    role: "UI/UX Developer & QA Tester",
    image: "/zedev/Sneha.png",
    icon: Layout,
    bio: "Designed the clinical UI, built frontend components, contributed to preprocessing research, and conducted QA testing.",
    github: "https://github.com/SnehaSharma041",
    linkedin: "https://www.linkedin.com/in/sneha-sharma-90012b296/",
    email: "snehasnehasharma0918@gmail.com",
  },
  {
    name: "Sathi Chakraborty",
    role: "Project Documentation & Coordination",
    image: "/zedev/Sathi.png",
    icon: FileText,
    bio: "Contributing to research paper preparation, documentation structuring, and compilation of technical findings for publication and review.",
    github: "https://github.com/54th1",
    linkedin: "https://www.linkedin.com/in/sathi-chakraborty-92a342287/",
    email: "sathichakraborty15@gmail.com",
  },
  {
    name: "Siddhartha Shankar Dhar",
    role: "ML Developer — Classification System",
    image: "/zedev/Siddharth.png",
    icon: BrainCircuit,
    bio: "Built and trained the classification system, Grad-CAM visualization, and contributed to data preparation and TI-RADS engine.",
    github: "https://github.com/kisato-ken",
    linkedin: "https://www.linkedin.com/in/siddharthadhar04/",
    email: "kisato.ken@protonmail.com",
  },
];

// ─── Reusable card ────────────────────────────────────────────────────────────
function MemberCard({
  member,
  idx,
}: {
  member: (typeof teamMembers)[number];
  idx: number;
}) {
  const MemberIcon = member.icon;
  return (
    <Card
      className="group relative bg-card/30 backdrop-blur-md border border-border/50 overflow-hidden hover:border-primary/50 transition-all hover:bg-card/40 hover:shadow-2xl hover:shadow-primary/5 animate-in fade-in slide-in-from-bottom-4"
      style={{
        animationDelay: `${idx * 100}ms`,
        animationFillMode: "both",
      }}
    >
      <div className="space-y-6" style={{ padding: "32px" }}>
        {/* Profile header */}
        <div className="flex items-start justify-between">
          <MemberAvatar src={member.image} name={member.name} />
          <div className="flex gap-2">
            <Link href={member.github} target="_blank">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
              >
                <Github className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={member.linkedin} target="_blank">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
              >
                <Linkedin className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Name & role */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {member.name}
          </h3>
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <MemberIcon className="h-4 w-4" />
            {member.role}
          </div>
        </div>

        {/* Bio */}
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 italic">
          "{member.bio}"
        </p>

        {/* Contact */}
        <div className="pt-4">
          <Link href={`mailto:${member.email}`}>
            <Button className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 hover:border-primary transition-all gap-2 h-11">
              <Mail className="h-4 w-4" />
              Send Email
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ContactPage() {
  const topRow = teamMembers.slice(0, 3);
  const bottomRow = teamMembers.slice(3, 7);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <AuroraBackground />
      <ParticleBackground />

      <NavHeader />

      <div className="relative z-10 flex-1 py-12">
        {/* ── Hero intro + top row — constrained width ── */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Team Intro */}
          <div className="flex flex-col md:flex-row items-center gap-8 mb-20">
            <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-3xl overflow-hidden shadow-2xl border border-primary/20 bg-card/50 backdrop-blur-xl flex items-center justify-center p-4">
              <Image
                src="/zedev/zedev_logo_1772394873377.png"
                alt="ZeDev Logo"
                fill
                className="object-contain p-4"
              />
            </div>
            <div className="text-center md:text-left space-y-4 max-w-2xl">
              <Badge
                variant="outline"
                className="border-primary/50 text-primary px-3 py-1"
              >
                The Team
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground">
                ZeDev{" "}
                <span className="text-primary font-light italic">
                  Collective
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                A student-led team of developers, designers, and innovators dedicated to building impactful healthcare technology. We specialize in AI-driven solutions that empower clinical decision-making.
              </p>
            </div>
          </div>

          {/* ── Top row: 3 cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {topRow.map((member, idx) => (
              <MemberCard key={member.name} member={member} idx={idx} />
            ))}
          </div>
        </div>

        {/* ── Bottom row: 4 cards ──
             Inspected top card = 382px wide, gap-8 = 32px, lg:px-8 = 32px each side
             Container = 4×382 + 3×32 + 2×32 = 1688px                    ── */}
        <div
          style={{ maxWidth: "1688px" }}
          className="mx-auto px-4 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {bottomRow.map((member, idx) => (
              <MemberCard key={member.name} member={member} idx={idx + 3} />
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
