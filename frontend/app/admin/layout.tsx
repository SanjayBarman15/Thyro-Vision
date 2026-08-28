//app/admin/layout.tsx
'use client'

import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { role, isLoading } = useAuthStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    
    // 1. Invalidate all React Query data
    await queryClient.invalidateQueries()
    
    // 2. Refresh server-side data & router cache
    router.refresh()
    
    // 3. Visual feedback duration
    setTimeout(() => setIsRefreshing(false), 800)
  }

  useEffect(() => {
    // If loading is done and role is not admin, redirect
    if (!isLoading && role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [role, isLoading, router])

  // Show loading state while checking role
  if (isLoading || role === null) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-slate-400">Verifying Admin Access...</p>
        </div>
      </div>
    )
  }

  // If not admin, return null while waiting for the redirect useEffect to trigger
  if (role !== 'admin') {
    return null
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-slate-950 overflow-hidden">
        <AdminSidebar />
        <SidebarInset className="bg-slate-950">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1 text-slate-400 hover:text-white transition-colors" />
              <div className="h-4 w-px bg-slate-800 mx-2" />
              <span className="text-sm font-medium text-slate-400">Admin Panel</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800 rounded-md transition-all active:scale-95 disabled:opacity-50"
              title="Refresh all data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </header>
          <main className="flex-1 overflow-y-auto custom-scrollbar p-6 text-slate-100">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
