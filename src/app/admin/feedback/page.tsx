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
      <h1 className="text-2xl font-bold text-heading mb-2">Tips från testare</h1>
      <p className="text-secondary mb-6">
        Buggrapporter och idéer från PRE-GO-LIVE-testarna. Klicka på en rad för
        att läsa hela tipset och ändra status.
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
): s is "open" | "triaged" | "in_progress" | "done" | "wont_fix" | "duplicate" | "all" {
  return (
    s === "open" ||
    s === "triaged" ||
    s === "in_progress" ||
    s === "done" ||
    s === "wont_fix" ||
    s === "duplicate" ||
    s === "all"
  );
}

function isKind(k: string | undefined): k is "bug" | "idea" | "all" {
  return k === "bug" || k === "idea" || k === "all";
}
