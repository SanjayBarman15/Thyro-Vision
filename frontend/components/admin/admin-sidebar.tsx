//app/admin/admin-sidebar.tsx
"use client";

import {
  BarChart3,
  Database,
  FileText,
  LogOut,
  User as UserIcon,
  FlaskConical,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { signout } from "@/app/login/actions";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

// Single instance outside component
const supabase = createClient();

interface SidebarBadges {
  curation: number; // pending training_labels count
  logs: number; // today's ERROR + FATAL count
}

export function AdminSidebar() {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const [badges, setBadges] = useState<SidebarBadges>({
    curation: 0,
    logs: 0,
  });

  // ── Fetch badge counts ──────────────────────────────────
  const fetchBadges = async () => {
    try {
      const [{ data: criticalLogs }, { count: pendingLabels }] =
        await Promise.all([
          // Today's ERROR + FATAL count
          supabase.rpc("get_critical_log_count"),
          // Pending curation labels
          // supabase
          //   .from("training_labels")
          //   .select("*", { count: "exact", head: true })
          //   .eq("status", "draft"),

          supabase
            .from("training_labels")
            .select("*", { count: "exact", head: true })
            .eq("approved", false),
        ]);

      setBadges({
        logs: criticalLogs ?? 0,
        curation: pendingLabels ?? 0,
      });
    } catch (error) {
      console.error("Sidebar badge fetch failed:", error);
    }
  };

  // Fetch on mount + every 60s
  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 60_000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    {
      title: "Performance",
      url: "/admin/performance",
      icon: BarChart3,
      badge: null,
      badgeVariant: undefined,
    },
    {
      title: "Benchmark",
      url: "/admin/benchmark",
      icon: FlaskConical,
      badge: null,
      badgeVariant: undefined,
    },
    {
      title: "Curation",
      url: "/admin/curation",
      icon: Database,
      badge: badges.curation > 0 ? String(badges.curation) : null,
      badgeVariant: "outline" as const,
    },
    {
      title: "Logs",
      url: "/admin/logs",
      icon: FileText,
      badge: badges.logs > 0 ? String(badges.logs) : null,
      badgeVariant: "destructive" as const,
    },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-slate-800 bg-slate-950"
    >
      <SidebarHeader className="border-b border-slate-800 p-2">
        <div
          className="flex items-center gap-2 px-2 
                        group-data-[collapsible=icon]:px-0 
                        group-data-[collapsible=icon]:justify-center"
        >
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center 
                          rounded-lg bg-primary/10 overflow-hidden"
          >
            <Image
              src="/TV2.png"
              alt="ThyroVision Logo"
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-slate-100 italic tracking-tight">
              ThyroVision
            </span>
            <Badge
              variant="outline"
              className="w-fit text-[10px] uppercase tracking-wider 
                         text-primary border-primary/20 bg-primary/5"
            >
              Admin
            </Badge>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent
        className="group-data-[collapsible=icon]:p-0 
                                  transition-all duration-200"
      >
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="hover:bg-slate-900 
                               data-[active=true]:bg-primary/10 
                               data-[active=true]:text-primary 
                               group-data-[collapsible=icon]:justify-center"
                  >
                    <Link
                      href={item.url}
                      className="flex items-center w-full 
                                 group-data-[collapsible=icon]:justify-center"
                    >
                      <item.icon
                        className="h-4 w-4 shrink-0 
                                            group-data-[collapsible=expanded]:mr-2"
                      />
                      <span
                        className="flex-1 truncate 
                                       group-data-[collapsible=icon]:hidden"
                      >
                        {item.title}
                      </span>
                      {item.badge && (
                        <Badge
                          variant={item.badgeVariant ?? "secondary"}
                          className={cn(
                            "ml-auto h-5 px-1.5 text-[10px] font-bold group-data-[collapsible=icon]:hidden",
                            item.title === "Curation" &&
                              "bg-primary/10 text-primary border-primary/20"
                          )}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className="border-t border-slate-800 
                                 group-data-[collapsible=icon]:p-0"
      >
        <SidebarMenu className="group-data-[collapsible=icon]:p-2">
          <SidebarMenuItem>
            <div
              className="flex items-center gap-3 px-2 py-2 text-sm 
                            text-slate-300 
                            group-data-[collapsible=icon]:px-0 
                            group-data-[collapsible=icon]:justify-center"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center 
                              rounded-full bg-slate-800"
              >
                <UserIcon className="h-4 w-4" />
              </div>
              <div
                className="flex flex-col overflow-hidden 
                              group-data-[collapsible=icon]:hidden"
              >
                <span className="font-medium text-slate-100 truncate">
                  {user?.user_metadata?.full_name || "Admin"}
                </span>
                <span className="text-xs text-slate-500 truncate">
                  {user?.email}
                </span>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => signout()}
              tooltip="Logout"
              className="text-slate-400 hover:text-red-400 
                         hover:bg-red-400/10 
                         group-data-[collapsible=icon]:justify-center"
            >
              <LogOut
                className="h-4 w-4 shrink-0 
                                 group-data-[collapsible=expanded]:mr-2"
              />
              <span className="group-data-[collapsible=icon]:hidden">
                Logout
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
