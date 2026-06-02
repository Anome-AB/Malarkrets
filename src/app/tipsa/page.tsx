import { requireAuth } from "@/lib/auth";
import { TipsaForm } from "./tipsa-form";

export const metadata = {
  title: "Tipsa oss - Vänliga Västerås",
};

export default async function TipsaPage() {
  await requireAuth();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
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
