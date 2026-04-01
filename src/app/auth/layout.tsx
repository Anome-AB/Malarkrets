import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${inter.variable} font-[family-name:var(--font-inter)] flex min-h-screen items-center justify-center bg-[#f8f7f4] px-4`}
    >
      {children}
    </div>
  );
}
