import type React from "react";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoeyToaster } from "@/components/ui/goey-toaster";
import QueryProvider from "@/components/providers/QueryProvider";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/lib/auth";
import AuthProvider from "@/components/providers/AuthProvider";
import { NotificationManager } from "@/components/providers/NotificationManager";
import { Inter } from "next/font/google";
import "./globals.css";
import { Agentation } from "agentation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThyroVision",
  description:
    "AI-assisted thyroid ultrasound analysis platform for clinical decision support",
  generator: "none",
  icons: {
    icon: [
      { url: "/TV2.png", sizes: "32x32", type: "image/png" },
      { url: "/TV2.ico", sizes: "48x48", type: "image/x-icon" },
    ],
    apple: "/TV2.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role = await getUserRole();

  return (
    <html
      lang="en"
      className={`dark ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          async
          crossOrigin="anonymous"
          src="https://tweakcn.com/live-preview.min.js"
        />
      </head>
      <body className={`font-sans antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <AuthProvider initialUser={session?.user ?? null} initialRole={role}>
            {children}
            {process.env.NODE_ENV === "development" && <Agentation />}
            <NotificationManager />
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        <GoeyToaster position="bottom-center" />
      </body>
    </html>
  );
}
