import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyTipDetail } from "@/actions/feedback-tips";
import { TipDetailClient } from "./tip-detail-client";

export const metadata = {
  title: "Tipsdetalj - Vänliga Västerås",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MyTipDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tip = await getMyTipDetail(id);
  if (!tip) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/mina-tips"
        className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-4"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Tillbaka till Mina tips
      </Link>

      <TipDetailClient tip={tip} />
    </div>
  );
}
