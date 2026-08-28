"use client";

import { Construction, LifeBuoy } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function HelpPage() {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center px-6 py-4 gap-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground md:hidden" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Help & Support</h1>
            <p className="text-xs text-muted-foreground">Get assistance with ThyroVision</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-card border border-border/60 rounded-3xl p-12 max-w-md w-full flex flex-col items-center shadow-sm">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 relative">
            <LifeBuoy className="w-10 h-10 text-primary absolute opacity-20" />
            <Construction className="w-8 h-8 text-primary relative z-10" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Under Construction</h2>
          <p className="text-muted-foreground text-sm mb-8">
            We are currently building a comprehensive help center and knowledge base. Please check back soon!
          </p>
          
          <div className="bg-muted/50 rounded-xl p-4 w-full text-sm border border-border/50">
            <p className="text-muted-foreground mb-1">Need immediate assistance?</p>
            <a href="mailto:support@thyrovision.ai" className="text-primary hover:underline font-medium">
              support@thyrovision.ai
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
