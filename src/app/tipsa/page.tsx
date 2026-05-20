import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { TipsaForm } from "./tipsa-form";

export const metadata = {
  title: "Tipsa oss - Mälarkrets",
};

export default async function TipsaPage() {
  await requireAuth();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-4"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Tillbaka till Mälarkrets
      </Link>
      <h1 className="text-3xl font-display font-bold text-heading">
        Tipsa oss
      </h1>
      <p className="text-secondary mt-2 max-w-2xl">
        Hittade du något konstigt, ett fel, eller har du ett förslag? Skriv
        till oss så kikar vi på det så snart som möjligt!
      </p>

      <div className="mt-8">
        <TipsaForm />
      </div>
    </div>
  );
}
