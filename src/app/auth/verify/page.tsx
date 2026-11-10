import Link from "next/link";
import { verifyEmail } from "@/actions/auth";

// Både "ingen token i URL:en" och "token gick inte att lösa in" ser likadana
// ut för användaren med flit: vi avslöjar inte om länken var påhittad eller
// bara utgången. Vägen vidare är densamma oavsett.
function InvalidLink() {
  return (
    <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">Vänliga Västerås</h1>
        <p className="mt-4 text-sm text-error">
          Ogiltig eller utgången verifieringslänk.
        </p>
        <p className="mt-2 text-xs text-secondary">
          Länken är giltig i ett dygn, och en ny länk ersätter den gamla.
        </p>
        <Link
          href="/auth/verify-resend"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Skicka en ny länk
        </Link>
      </div>
    </div>
  );
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;

  if (!token || typeof token !== "string") {
    return <InvalidLink />;
  }

  const result = await verifyEmail(token);

  if (result.error) {
    return <InvalidLink />;
  }

  return (
    <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">Vänliga Västerås</h1>
        <p className="mt-4 text-sm text-heading">
          Din e-post är verifierad! Du kan nu logga in.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Logga in
        </Link>
      </div>
    </div>
  );
}
