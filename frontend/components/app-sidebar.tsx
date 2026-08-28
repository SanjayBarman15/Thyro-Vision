// frontend/components/app-sidebar.tsx
"use client";

import {
  LayoutDashboard,
  Users,
  ScanLine,
  FileText,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  FlaskConical,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signout } from "@/app/login/actions";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";

export function AppSidebar() {
  const pathname        = usePathname();
  const { stats, fetchDashboardData, doctorName, profile, fetchProfile } = useStore();

  // Fetch stats and profile for the sidebar
  useEffect(() => {
    fetchDashboardData();
    fetchProfile();
  }, [fetchDashboardData, fetchProfile]);

  const navigation = [
    {
      name:  "Dashboard",
      href:  "/dashboard",
      icon:  LayoutDashboard,
      badge: null,
    },
    {
      name:  "Patients",
      href:  "/dashboard/patients",
      icon:  Users,
      badge: null,
    },
    {
      name:  "Scans",
      href:  "/dashboard/scans",
      icon:  ScanLine,
      badge: null,
    },
    {
      name:  "Follow-ups",
      href:  "/dashboard/followups",
      icon:  Bell,
      badge: stats.overdueCount > 0 ? stats.overdueCount : null,
      badgeColor: "bg-red-500",
    },
  ];

  const secondaryNavigation = [
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "Help",     href: "/dashboard/help",     icon: HelpCircle },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-card/50 backdrop-blur-xl"
    >
      {/* ── Logo ── */}
      <SidebarHeader className="h-16 flex items-center px-6 border-b border-border/50">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary"
        >
          <img
            src="/TV2.png"
            alt="ThyroVision"
            className="h-8 w-8 object-contain shrink-0"
          />
          <span className="group-data-[collapsible=icon]:hidden">
            ThyroVision
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>

        {/* ── Main navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    tooltip={item.name}
                    className="h-11 px-4 transition-all duration-200
                               hover:bg-primary/10 hover:text-primary
                               data-[active=true]:bg-primary/10
                               data-[active=true]:text-primary"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                  {/* Badge — overdue count on Follow-ups */}
                  {item.badge != null && (
                    <SidebarMenuBadge
                      className={`text-white text-[10px] font-bold
                                   ${item.badgeColor || 'bg-primary'}`}
                    >
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Support ── */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="px-4 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Support
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.name}
                    className="h-11 px-4 transition-all duration-200
                               hover:bg-primary/10 hover:text-primary
                               data-[active=true]:bg-primary/10
                               data-[active=true]:text-primary"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>

      {/* ── Footer: user info + logout ── */}
      <SidebarFooter className="p-4 border-t border-border/50 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 border border-primary/20">
            {doctorName ? doctorName.charAt(0).toUpperCase() : "D"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-foreground">
              {doctorName ? `Dr. ${doctorName}` : "Doctor"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {profile?.department || "Endocrinology"}
            </span>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <form action={signout}>
              <SidebarMenuButton
                type="submit"
                tooltip="Sign out"
                className="h-11 px-4 text-red-500 hover:bg-red-500/10
                           hover:text-red-500 transition-all duration-200
                           cursor-pointer w-full"
              >
                <LogOut className="h-4 w-4" />
                <span className="font-medium">Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}