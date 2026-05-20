import { requireAuth } from "@/lib/auth";
import { TipsaForm } from "./tipsa-form";

export const metadata = {
  title: "Tipsa oss - Mälarkrets",
};

export default async function TipsaPage() {
  await requireAuth();

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-display font-bold text-heading">
        Tipsa oss
      </h1>
      <p className="text-secondary mt-2 max-w-2xl">
        Hittade du något konstigt eller har en idé? Skriv som du skulle berätta
        för en kompis. Vi läser allt själva.
      </p>

      <div className="mt-8">
        <TipsaForm />
      </div>
    </div>
  );
}
