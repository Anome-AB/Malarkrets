import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { SiteBanner } from "@/components/site-banner";
import { ConsoleCaptureProvider } from "@/components/layout/console-capture-provider";
import "./globals.css";

// metadataBase används av Next.js för att göra alla relativa URL:er i metadata
// (openGraph.images m.fl.) absoluta. Crawlers som Slack och Twitter följer
// inte relativa /api/images/<id>-paths, så utan detta får inläggen ingen
// förhandsgranskningsbild.
//
// AUTH_URL är samma variabel som NextAuth läser för callback-URL:er, så
// vi håller en source of truth för "vad är min publika bas-URL". Faller
// tillbaka på localhost i dev där AUTH_URL inte alltid är satt.
const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Vänliga Västerås",
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
        <ConsoleCaptureProvider />
        <SiteBanner />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
