"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function NavHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <img src="/TV2.png" alt="ThyroVision Logo" className="h-8 w-8 object-contain" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Thyro<span className="text-primary italic">Vision</span>
            </h1>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/how-it-works"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === "/how-it-works"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Process
            </Link>
            {/* <Link
              href="/contact"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === "/contact"
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              Team
            </Link> */}
          </nav>
        </div>

        {/* Centered Brand on subpages */}
        {/* {!isHome && (
          <div className="absolute left-1/2 -translate-x-1/2 font-bold text-xl tracking-tight pointer-events-none hidden lg:block">
            Thyro<span className="text-primary italic">Vision</span>
          </div>
        )} */}

        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:block">
            <Button
              variant="outline"
              size="sm"
              className="border-secondary text-secondary hover:bg-secondary/10 bg-transparent transition-all"
            >
              Login
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 shadow-lg shadow-primary/20 transition-all"
            >
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
