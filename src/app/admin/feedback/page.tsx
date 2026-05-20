import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listFeedbackTips } from "@/actions/admin-feedback-tips";
import { AdminFeedbackClient } from "./admin-feedback-client";

export const metadata = {
  title: "Tips från testare - Admin",
};

interface PageProps {
  searchParams: Promise<{ status?: string; kind?: string }>;
}

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  await requireAdmin();
  const params = await searchParams;

  const statusFilter = isStatus(params.status) ? params.status : "open";
  const kindFilter = isKind(params.kind) ? params.kind : "all";

  const tips = await listFeedbackTips({
    status: statusFilter,
    kind: kindFilter,
  });

  return (
    <div className="px-6 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-secondary hover:text-heading transition-colors mb-4"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Tillbaka till Mälarkrets
      </Link>
      <h1 className="text-2xl font-bold text-heading mb-2">Tips från testare</h1>
      <p className="text-secondary mb-6">
        Buggrapporter och förslag från PRE-GO-LIVE-testarna. Klicka på en rad
        för att läsa hela tipset och ändra status.
      </p>

      <AdminFeedbackClient
        initialTips={tips}
        initialStatus={statusFilter}
        initialKind={kindFilter}
      />
    </div>
  );
}

function isStatus(
  s: string | undefined,
): s is "open" | "triaged" | "in_progress" | "done" | "wont_fix" | "duplicate" | "all" | "unread" {
  return (
    s === "open" ||
    s === "triaged" ||
    s === "in_progress" ||
    s === "done" ||
    s === "wont_fix" ||
    s === "duplicate" ||
    s === "all" ||
    s === "unread"
  );
}

function isKind(k: string | undefined): k is "bug" | "idea" | "all" {
  return k === "bug" || k === "idea" || k === "all";
}
