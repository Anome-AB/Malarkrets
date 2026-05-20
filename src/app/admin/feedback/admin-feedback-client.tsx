"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AdminTipRow } from "@/actions/admin-feedback-tips";
import {
  updateTipStatus,
  updateTipSeverity,
  getTipCommentsForAdmin,
  getInterestSuggestionsForAdmin,
  approveInterestSuggestion,
  rejectInterestSuggestion,
  updateSuggestionName,
  type AdminInterestSuggestion,
} from "@/actions/admin-feedback-tips";
import { addTipComment, type TipComment } from "@/actions/feedback-tips";
import { CommentBubble } from "@/app/mina-tips/[id]/tip-detail-client";

type StatusKey = "open" | "triaged" | "in_progress" | "done" | "wont_fix" | "duplicate";
type SeverityKey = "blocker" | "high" | "medium" | "low";
type StatusFilter = StatusKey | "all" | "unread";
type KindFilter = "bug" | "idea" | "interest" | "all";

const STATUS_LABEL: Record<StatusKey, string> = {
  open: "Inkommit",
  triaged: "Vi har sett det",
  in_progress: "På gång",
  done: "Klart",
  wont_fix: "Vi tar inte det här",
  duplicate: "Duplikat",
};

const SEVERITY_LABEL: Record<SeverityKey, string> = {
  blocker: "Blocker",
  high: "Hög",
  medium: "Medel",
  low: "Låg",
};

const SEVERITY_BADGE: Record<SeverityKey, string> = {
  blocker: "bg-error text-white",
  high: "bg-warning text-white",
  medium: "bg-background text-heading border border-border",
  low: "bg-background text-secondary border border-border",
};

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "unread", label: "Oläst" },
  { value: "open", label: "Inkommit" },
  { value: "triaged", label: "Sett" },
  { value: "in_progress", label: "På gång" },
  { value: "done", label: "Klart" },
  { value: "wont_fix", label: "Tar ej" },
  { value: "duplicate", label: "Duplikat" },
  { value: "all", label: "Alla" },
];

const KIND_FILTERS: Array<{ value: KindFilter; label: string }> = [
  { value: "all", label: "Alla typer" },
  { value: "bug", label: "Bugg" },
  { value: "idea", label: "Förslag" },
  { value: "interest", label: "Intresseförslag" },
];

function kindEmoji(kind: "bug" | "idea" | "interest"): string {
  if (kind === "bug") return "🐞";
  if (kind === "idea") return "💡";
  return "🏷️";
}

function kindLabel(kind: "bug" | "idea" | "interest"): string {
  if (kind === "bug") return "Bugg";
  if (kind === "idea") return "Förslag";
  return "Intresseförslag";
}

interface AdminFeedbackClientProps {
  initialTips: AdminTipRow[];
  initialStatus: StatusFilter;
  initialKind: KindFilter;
}

export function AdminFeedbackClient({
  initialTips,
  initialStatus,
  initialKind,
}: AdminFeedbackClientProps) {
  const router = useRouter();
  const [openTip, setOpenTip] = useState<AdminTipRow | null>(null);

  function setFilter(next: { status?: StatusFilter; kind?: KindFilter }) {
    const status = next.status ?? initialStatus;
    const kind = next.kind ?? initialKind;
    const params = new URLSearchParams();
    if (status !== "unread") params.set("status", status);
    if (kind !== "all") params.set("kind", kind);
    const qs = params.toString();
    router.replace(`/admin/feedback${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <FilterChips
          label="Status"
          options={STATUS_FILTERS}
          active={initialStatus}
          onSelect={(v) => setFilter({ status: v })}
        />
        <FilterChips
          label="Typ"
          options={KIND_FILTERS}
          active={initialKind}
          onSelect={(v) => setFilter({ kind: v })}
        />
      </div>

      {initialTips.length === 0 ? (
        <Card>
          <p className="text-center text-secondary py-8">
            Inga tips matchar filtret.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-secondary border-b border-border">
                <tr>
                  <th className="py-2 pr-3 w-12">Typ</th>
                  <th className="py-2 pr-3 w-24">Severity</th>
                  <th className="py-2 pr-3">Sammanfattning</th>
                  <th className="py-2 pr-3 w-16">Svar</th>
                  <th className="py-2 pr-3 w-44">Rapportör</th>
                  <th className="py-2 pr-3 w-32">Status</th>
                  <th className="py-2 pr-3 w-28 font-mono">Aktivitet</th>
                </tr>
              </thead>
              <tbody>
                {initialTips.map((tip) => (
                  <tr
                    key={tip.id}
                    onClick={() => setOpenTip(tip)}
                    className={`border-b border-border-light cursor-pointer transition-colors ${
                      tip.hasUnread
                        ? "bg-accent-light hover:bg-accent-light/80"
                        : "hover:bg-primary-light/40"
                    }`}
                  >
                    <td className="py-3 pr-3 text-xl relative" aria-label={tip.kind}>
                      {tip.hasUnread && (
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-accent"
                          aria-label="Oläst aktivitet"
                        />
                      )}
                      {kindEmoji(tip.kind)}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[tip.severity]}`}
                      >
                        {SEVERITY_LABEL[tip.severity]}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-heading">
                      <div className="truncate max-w-md">
                        {firstLine(tip.description)}
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-secondary text-xs">
                      {tip.commentCount > 0 ? `${tip.commentCount}` : "—"}
                    </td>
                    <td className="py-3 pr-3 text-secondary">
                      {tip.reporterDisplayName ?? tip.reporterEmail ?? "okänd"}
                    </td>
                    <td className="py-3 pr-3 text-heading">
                      {STATUS_LABEL[tip.status]}
                    </td>
                    <td className="py-3 pr-3 text-secondary font-mono text-xs">
                      {formatDate(tip.lastActivityAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {openTip && (
        <TipDetailModal
          tip={openTip}
          onClose={() => setOpenTip(null)}
        />
      )}
    </div>
  );
}

interface FilterChipsProps<T extends string> {
  label: string;
  options: Array<{ value: T; label: string }>;
  active: T;
  onSelect: (value: T) => void;
}

function FilterChips<T extends string>({
  label,
  options,
  active,
  onSelect,
}: FilterChipsProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-secondary mr-1">
        {label}:
      </span>
      {options.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`
              px-3 py-1.5 rounded-full text-sm transition-colors
              ${isActive
                ? "bg-primary text-white"
                : "bg-white text-heading border border-border hover:border-primary"}
            `}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface TipDetailModalProps {
  tip: AdminTipRow;
  onClose: () => void;
}

function TipDetailModal({ tip, onClose }: TipDetailModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState<StatusKey>(tip.status);
  const [severity, setSeverity] = useState<SeverityKey>(tip.severity);
  const [comments, setComments] = useState<TipComment[] | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [sendingComment, startSendComment] = useTransition();
  const [saving, startSaving] = useTransition();
  const [suggestions, setSuggestions] = useState<
    AdminInterestSuggestion[] | null
  >(null);
  const [, startSuggestionAction] = useTransition();

  async function refreshSuggestions() {
    if (tip.kind !== "interest") return;
    const rows = await getInterestSuggestionsForAdmin(tip.id);
    setSuggestions(rows);
  }

  const statusChanged = status !== tip.status;
  const severityChanged = severity !== tip.severity;
  const hasChanges = statusChanged || severityChanged;

  function handleSaveAll() {
    if (!hasChanges) return;
    startSaving(async () => {
      let allOk = true;

      if (severityChanged) {
        const r = await updateTipSeverity({ tipId: tip.id, severity });
        if (!r.success) allOk = false;
      }

      if (statusChanged) {
        const r = await updateTipStatus({ tipId: tip.id, status });
        if (!r.success) allOk = false;
      }

      if (allOk) {
        toast("Sparat", "success");
        router.refresh();
        onClose();
      } else {
        toast("Något gick fel", "error");
      }
    });
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open.
    setComments(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same as above
    setSuggestions(null);
    getTipCommentsForAdmin(tip.id).then((rows) => {
      if (!cancelled) setComments(rows);
    });
    if (tip.kind === "interest") {
      getInterestSuggestionsForAdmin(tip.id).then((rows) => {
        if (!cancelled) setSuggestions(rows);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [tip.id, tip.kind]);

  function handleSendComment() {
    if (commentBody.trim().length === 0) return;
    startSendComment(async () => {
      const result = await addTipComment({
        tipId: tip.id,
        body: commentBody.trim(),
      });
      if (result.success) {
        setCommentBody("");
        toast("Svar skickat", "success");
        const fresh = await getTipCommentsForAdmin(tip.id);
        setComments(fresh);
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  const hasMetadata =
    tip.pageUrl || tip.userAgent || tip.viewportWidth || tip.appVersion;

  return (
    <Modal
      open
      onClose={onClose}
      title="Tips från testare"
      size="xl"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            size="compact"
            disabled={saving}
          >
            Avbryt
          </Button>
          <Button
            type="button"
            size="compact"
            onClick={handleSaveAll}
            loading={saving}
            disabled={!hasChanges}
          >
            Spara
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
          <span className="text-2xl" aria-hidden="true">
            {kindEmoji(tip.kind)}
          </span>
          <span className="text-heading font-medium">
            {kindLabel(tip.kind)}
          </span>
          <span className="font-mono text-xs">
            {formatDate(tip.createdAt)}
          </span>
          <span>·</span>
          <span>
            {tip.reporterDisplayName ?? tip.reporterEmail ?? "okänd rapportör"}
          </span>
          {tip.reporterEmail && (
            <a
              href={`mailto:${tip.reporterEmail}`}
              className="text-primary hover:underline"
            >
              {tip.reporterEmail}
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor={`status-${tip.id}`}
              className="block text-sm font-medium text-heading mb-1"
            >
              Status
            </label>
            <select
              id={`status-${tip.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusKey)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(STATUS_LABEL) as StatusKey[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`severity-${tip.id}`}
              className="block text-sm font-medium text-heading mb-1"
            >
              Severity
            </label>
            <select
              id={`severity-${tip.id}`}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityKey)}
              className="w-full rounded-control border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(SEVERITY_LABEL) as SeverityKey[]).map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tip.kind === "interest" && (
          <div className="rounded-control border border-border bg-background p-4 space-y-3">
            <h3 className="text-sm font-semibold text-heading">
              Föreslagna intressen
            </h3>
            {suggestions === null ? (
              <p className="text-sm text-secondary">Laddar förslag...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-secondary">
                Inga förslag på den här tipset.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <InterestSuggestionAdminRow
                    key={s.id}
                    suggestion={s}
                    onChange={refreshSuggestions}
                    onAction={(fn) =>
                      startSuggestionAction(async () => {
                        const r = await fn();
                        if (r.success) {
                          await refreshSuggestions();
                          router.refresh();
                          toast("Sparat", "success");
                        } else {
                          toast(r.error ?? "Något gick fel", "error");
                        }
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        )}

        {tip.description && (
          <Card>
            <p className="text-heading whitespace-pre-wrap">{tip.description}</p>
          </Card>
        )}

        {tip.screenshotImageId && (
          <div>
            <h3 className="text-sm font-semibold text-heading mb-2">
              Skärmdump
            </h3>
            <a
              href={`/api/images/${tip.screenshotImageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-control overflow-hidden border border-border"
            >
              <img
                src={`/api/images/${tip.screenshotImageId}`}
                alt="Skärmdump från testaren"
                className="w-full"
              />
            </a>
          </div>
        )}

        {hasMetadata && (
          <details className="rounded-control border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-heading hover:bg-primary-light">
              Teknisk info
            </summary>
            <dl className="px-4 py-3 space-y-2 text-xs font-mono text-secondary border-t border-border">
              {tip.pageUrl && (
                <MetadataRow label="URL" value={tip.pageUrl} />
              )}
              {tip.appVersion && (
                <MetadataRow label="App-version" value={tip.appVersion} />
              )}
              {tip.viewportWidth && tip.viewportHeight && (
                <MetadataRow
                  label="Viewport"
                  value={`${tip.viewportWidth}×${tip.viewportHeight}`}
                />
              )}
              {tip.userAgent && (
                <MetadataRow label="User-Agent" value={tip.userAgent} />
              )}
            </dl>
          </details>
        )}

        {tip.consoleLog && (
          <details className="rounded-control border border-border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-heading hover:bg-primary-light">
              Console-log ({tip.consoleLog.split("\n").length} rader)
            </summary>
            <pre className="px-4 py-3 text-xs font-mono text-secondary border-t border-border max-h-80 overflow-auto whitespace-pre-wrap">
              {tip.consoleLog}
            </pre>
          </details>
        )}

        <div className="pt-3 border-t border-border space-y-3">
          <h3 className="text-sm font-semibold text-heading">
            Konversation ({comments?.length ?? 0})
          </h3>
          {comments === null ? (
            <p className="text-sm text-secondary">Laddar tråd...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-secondary">
              Inga svar ännu. Ställ en följdfråga eller bekräfta att ni tar tag i det.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <CommentBubble key={c.id} comment={c} viewerIsReporter={false} />
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              rows={3}
              placeholder="Svara till testaren..."
              className="w-full rounded-control border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={4000}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="compact"
                onClick={handleSendComment}
                loading={sendingComment}
                disabled={commentBody.trim().length === 0}
              >
                Skicka svar
              </Button>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-heading">{label}</dt>
      <dd className="break-all">{value}</dd>
    </div>
  );
}

interface InterestSuggestionAdminRowProps {
  suggestion: AdminInterestSuggestion;
  onChange: () => Promise<void> | void;
  onAction: (
    fn: () => Promise<{ success: boolean; error?: string }>,
  ) => void;
}

const SUGGESTION_BADGE: Record<
  AdminInterestSuggestion["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-background text-secondary border border-border",
  },
  approved: {
    label: "Godkänt",
    className: "bg-primary text-white",
  },
  rejected: {
    label: "Avslaget",
    className: "bg-error/10 text-error border border-error/30",
  },
  duplicate: {
    label: "Fanns redan",
    className: "bg-accent-light text-heading border border-accent",
  },
};

function InterestSuggestionAdminRow({
  suggestion,
  onAction,
}: InterestSuggestionAdminRowProps) {
  const [name, setName] = useState(suggestion.name);
  const nameChanged = name.trim() !== suggestion.name;
  const isPending = suggestion.status === "pending";
  const badge = SUGGESTION_BADGE[suggestion.status];

  function approve() {
    onAction(async () => {
      if (nameChanged) {
        const r = await updateSuggestionName({
          suggestionId: suggestion.id,
          name: name.trim(),
        });
        if (!r.success) return r;
      }
      return approveInterestSuggestion({ suggestionId: suggestion.id });
    });
  }

  function reject() {
    onAction(async () => {
      return rejectInterestSuggestion({ suggestionId: suggestion.id });
    });
  }

  if (!isPending) {
    return (
      <li className="flex items-start justify-between gap-3 rounded-control bg-white border border-border px-3 py-2">
        <div className="flex-1">
          <p className="text-heading font-medium">{suggestion.name}</p>
          {suggestion.approvedAsTagName &&
            suggestion.approvedAsTagName !== suggestion.name && (
              <p className="text-xs text-secondary">
                Som tagg:{" "}
                <span className="font-medium">
                  {suggestion.approvedAsTagName}
                </span>
              </p>
            )}
        </div>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
        >
          {badge.label}
        </span>
      </li>
    );
  }

  return (
    <li className="rounded-control bg-white border border-border px-3 py-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        className="w-full rounded-control border border-border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="ghost"
          size="compact"
          onClick={reject}
        >
          Avslå
        </Button>
        <Button type="button" size="compact" onClick={approve}>
          {nameChanged ? "Spara + Godkänn" : "Godkänn"}
        </Button>
      </div>
    </li>
  );
}

function firstLine(text: string): string {
  const newline = text.indexOf("\n");
  if (newline === -1) return text;
  return text.slice(0, newline);
}

function formatDate(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleDateString("sv-SE", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });
}
