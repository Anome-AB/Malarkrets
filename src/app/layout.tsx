import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { SiteBanner } from "@/components/site-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mälarkrets",
  description: "Hitta ditt sammanhang i Västerås",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className="antialiased">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@700,900&f[]=instrument-sans@400,500,600&display=swap" rel="stylesheet" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-heading min-h-screen">
        <SiteBanner />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
