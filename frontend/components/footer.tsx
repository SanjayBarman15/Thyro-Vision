"use client";

import Link from "next/link";
import { Github, Globe, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/50 py-12 px-6 bg-background/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-2 space-y-4">
            <h3 className="text-xl font-bold text-foreground tracking-tight">
              Thyro<span className="text-primary italic">Vision</span>
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              AI-assisted clinical decision support for thyroid ultrasound
              analysis. Empowering medical professionals with precision and
              evidence-based insights.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <Link
                href="https://github.com/SanjayBarman15/ThyroVision"
                className="p-2 rounded-lg bg-card/50 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
              >
                <Github className="h-4 w-4" />
              </Link>
              <Link
                href="https://thyro-vision.vercel.app/"
                className="p-2 rounded-lg bg-card/50 border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
              >
                <Globe className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Platform
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="hover:text-primary transition-colors"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-primary transition-colors"
                >
                  Login
                </Link>
              </li>
              <li>
                <Link
                  href="/signup"
                  className="hover:text-primary transition-colors"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Support
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/contact"
                  className="hover:text-primary transition-colors font-medium text-primary"
                >
                  Contact ZeDev
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="hover:text-primary transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/legal"
                  className="hover:text-primary transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              Made with <Heart className="h-3 w-3 text-red-500 fill-red-500" />{" "}
              by
              <span className="font-bold text-foreground">ZeDev Collective</span>
            </div>
            <span className="hidden md:inline text-border">|</span>
            <span>&copy; 2026 ThyroVision. All rights reserved.</span>
          </div>

          <div className="text-xs text-muted-foreground/60">
            ⚠️<span className="italic">For research & academic purposes only.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
