// frontend/app/firebase-messaging-sw.js/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const swCode = `
    importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

    const hasConfig = ${!!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)};
    
    if (hasConfig) {
      firebase.initializeApp({
        apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}",
        authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",
        projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}",
        storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",
        messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",
        appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}",
        measurementId: "${process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}"
      });

      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        
        const notificationTitle = payload.notification.title;
        const notificationOptions = {
          body: payload.notification.body,
          icon: '/TV2.png'
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
      });
    } else {
      console.warn('[firebase-messaging-sw.js] Firebase config missing. Notifications disabled.');
    }
  `;

  return new NextResponse(swCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
