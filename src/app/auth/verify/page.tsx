import Link from "next/link";
import { verifyEmail } from "@/actions/auth";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await searchParams;

  if (!token || typeof token !== "string") {
    return (
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
          <p className="mt-4 text-sm text-error">
            Ogiltig eller utgången verifieringslänk.
          </p>
        </div>
      </div>
    );
  }

  const result = await verifyEmail(token);

  if (result.error) {
    return (
      <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
          <p className="mt-4 text-sm text-error">
            Ogiltig eller utgången verifieringslänk.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-card bg-white p-8 shadow">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary">Mälarkrets</h1>
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
