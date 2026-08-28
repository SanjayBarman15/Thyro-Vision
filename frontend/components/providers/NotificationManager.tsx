"use client";

import { useNotifications } from "@/hooks/useNotifications";

export function NotificationManager() {
  // This component initializes the notification listener and token refresh flow
  useNotifications();
  
  // It doesn't need to render anything visible (foreground messages are handled via toast)
  return null;
}
