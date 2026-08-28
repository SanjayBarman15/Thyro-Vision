// frontend/hooks/useNotifications.ts
"use client";

import { useEffect, useState } from "react";
import { messaging } from "@/utils/firebase";
import { getToken, onMessage } from "firebase/messaging";
import { createClient } from "@/utils/supabase/client";
import { goeyToast as toast } from "@/components/ui/goey-toaster";

export const useNotifications = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const registerTokenWithBackend = async (token: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000/api/v1";
        const response = await fetch(`${baseUrl}/profiles/fcm-token`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            fcm_token: token,
            email: session.user.email
          })
        });
        
        if (!response.ok) {
           console.warn("Backend failed to store FCM token", await response.text());
        } else {
           console.log("FCM Token registered successfully with backend");
           toast.success("Push notifications active");
        }
      } catch (err) {
        console.error("Failed to sync FCM token", err);
      }
    };

    const requestPermission = async () => {
      // 1. Feature detection
      if (typeof window === "undefined" || !messaging || !("Notification" in window)) {
        console.warn("Notifications or Messaging not supported/initialized");
        return;
      }

      try {
        // 2. Request permission
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // 3. Get token (VAPID Key from .env.local)
          const currentToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
          });

          if (currentToken) {
            setFcmToken(currentToken);
            await registerTokenWithBackend(currentToken);
          } else {
            console.warn("No registration token available. Request permission to generate one.");
          }
        }
      } catch (error) {
        console.error("An error occurred while retrieving token. ", error);
      }
    };

    requestPermission();

    // Foreground listener
    if (!messaging) return;
    
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("Message received in foreground: ", payload);
      
      const displayTitle = payload.notification?.title || (payload.data && payload.data.title);
      const displayBody = payload.notification?.body || (payload.data && payload.data.body) || "New information available";

      // Combine title and body for the toast message
      const fullMessage = displayTitle ? `${displayTitle}: ${displayBody}` : displayBody;

      toast.success(fullMessage);
    });

    return () => unsubscribe();
  }, [supabase]);

  return { fcmToken };
};
