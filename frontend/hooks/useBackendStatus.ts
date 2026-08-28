import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { goeyToast as toast } from '@/components/ui/goey-toaster';

const supabase = createClient();
const POLL_INTERVAL = 30_000;
const HEALTH_POLL_INTERVAL = 60_000;

export type BackendStatus = 'online' | 'offline' | 'checking';

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [lastOnline, setLastOnline] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use a ref to prevent recreation of the check function 
  // and to track status without triggering re-renders in the callback
  const statusRef = useRef<BackendStatus>('checking');

  // ── Persistence & Initialization ──────────────────────────
  useEffect(() => {
    const savedTime = localStorage.getItem('thyrovision_last_online');
    const savedStatus = localStorage.getItem('thyrovision_backend_status') as BackendStatus;
    
    if (savedTime) setLastOnline(new Date(savedTime));
    if (savedStatus) {
      setStatus(savedStatus);
      statusRef.current = savedStatus;
    }
  }, []);

  const updatePersistence = useCallback((newStatus: BackendStatus, newTime?: Date) => {
    localStorage.setItem('thyrovision_backend_status', newStatus);
    if (newTime) {
      localStorage.setItem('thyrovision_last_online', newTime.toISOString());
      setLastOnline(newTime);
    }
  }, []);

  // ── Logging ───────────────────────────────────────────────
  const logStatusChange = useCallback(async (newStatus: 'online' | 'offline', isBackground: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('system_logs').insert({
        level: newStatus === 'online' ? 'INFO' : 'ERROR',
        action: 'BACKEND_STATUS_CHANGE',
        actor_id: user.id,
        actor_role: 'admin',
        request_id: crypto.randomUUID(),
        metadata: {
          status: newStatus,
          timestamp: new Date().toISOString(),
          check_type: isBackground ? 'auto' : 'manual'
        },
        error_code: newStatus === 'offline' ? 'ERR_BACKEND_OFFLINE' : 'OK_BACKEND_RECOVERY',
        error_message: newStatus === 'offline' ? 'Backend service unreachable' : 'Backend service restored'
      });
    } catch (err) {
      console.error("Failed to log status change:", err);
    }
  }, []);

  // ── Health Check Logic ────────────────────────────────────
  const checkHealth = useCallback(async (isInitial = false, isBackground = false) => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    
    if (!isBackground || isInitial) {
      setIsRefreshing(true);
      setStatus('checking');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${backendUrl}/`, { 
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        if (!isBackground && !isInitial) {
          toast.success("Backend Online", { description: "API services are fully operational." });
        }
        
        const prev = statusRef.current;
        if (prev === 'offline') {
          logStatusChange('online', isBackground);
        }
        
        setStatus('online');
        statusRef.current = 'online';
        const now = new Date();
        updatePersistence('online', now);
      } else {
        throw new Error('Offline');
      }
    } catch (err) {
      if (!isBackground && !isInitial) {
        toast.error("Backend Offline", { description: "Could not connect to the API." });
      }
      
      const prev = statusRef.current;
      if (prev === 'online' || prev === 'checking') {
        logStatusChange('offline', isBackground);
      }
      
      setStatus('offline');
      statusRef.current = 'offline';
      updatePersistence('offline');
    } finally {
      setIsRefreshing(false);
    }
  }, [logStatusChange, updatePersistence]);

  // ── Auto Polling ──────────────────────────────────────────
  useEffect(() => {
    // Initial silent check
    checkHealth(true, true);

    const interval = setInterval(() => {
      checkHealth(false, true);
    }, HEALTH_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [checkHealth]);

  return {
    status,
    lastOnline,
    isRefreshing,
    checkHealth
  };
}
