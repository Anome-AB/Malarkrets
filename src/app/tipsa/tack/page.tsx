import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";

export const metadata = {
  title: "Tack för tipset - Vänliga Västerås",
};

export default async function TipsaTackPage() {
  await requireAuth();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Card>
        <div className="text-center space-y-5">
          <div className="text-5xl" aria-hidden="true">🙏</div>
          <h1 className="text-2xl font-display font-bold text-heading">
            Tack! Tipset är inskickat.
          </h1>
          <p className="text-secondary">
            Vi läser allt själva. Vill du följa hur det går?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/mina-tips"
              className="inline-flex items-center justify-center min-h-touch-target rounded-control px-6 py-3 text-base font-medium bg-primary text-white hover:bg-primary-hover transition-colors"
            >
              Se mina tips
            </Link>
            <Link
              href="/tipsa"
              className="inline-flex items-center justify-center min-h-touch-target rounded-control px-6 py-3 text-base font-medium bg-background text-heading border border-border hover:bg-primary-light transition-colors"
            >
              Skicka ett till
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
