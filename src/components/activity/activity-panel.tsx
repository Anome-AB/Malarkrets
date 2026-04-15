"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getColorHex } from "@/lib/color-themes";
import { CourageSection } from "@/components/activity/courage-section";
import { CommentList } from "@/components/activity/comment-list";
import { AdminActivityControls } from "@/components/activity/admin-activity-controls";
import { useToast } from "@/components/ui/toast";
import { joinActivity, leaveActivity, getActivityDetail } from "@/actions/activities";
import { createComment, deleteComment } from "@/actions/comments";

interface ActivityDetail {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  startTime: Date | string;
  endTime: Date | string | null;
  maxParticipants: number | null;
  cancelledAt: Date | string | null;
  deletedAt: Date | string | null;
  imageMediumUrl: string | null;
  colorTheme: string | null;
  whatToExpect: Record<string, unknown> | null;
  creatorId: string | null;
  creatorName: string;
  creatorIsAdmin: boolean;
  viewerIsAdmin: boolean;
  tags: Array<{ id: number; name: string; slug: string }>;
  participantCount: number;
  comments: Array<{
    id: string;
    userId: string | null;
    authorName: string;
    content: string;
    createdAt: Date | string;
  }>;
  feedbackTotal: number;
  feedbackPositive: number;
  isParticipant: boolean;
  participationStatus: "interested" | "attending" | null;
  isCreator: boolean;
  currentUserId: string;
}

interface ActivityPanelProps {
  activityId: string;
  open: boolean;
  onClose: () => void;
}

export function ActivityPanel({ activityId, open, onClose }: ActivityPanelProps) {
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [visible, setVisible] = useState(false);

  // Fetch data when panel opens
  useEffect(() => {
    if (!open || !activityId) return;
    setLoading(true);
    setDetail(null);
    getActivityDetail(activityId).then((data) => {
      setDetail(data as ActivityDetail | null);
      setLoading(false);
    });
  }, [open, activityId]);

  // Slide-in animation
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Focus management
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => panelRef.current?.focus());
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function refreshPanel() {
    const updated = await getActivityDetail(activityId);
    setDetail(updated as ActivityDetail | null);
  }

  async function handleJoin(status: "attending" | "interested") {
    startTransition(async () => {
      const result = await joinActivity(activityId, status);
      if (result.success) {
        toast(status === "attending" ? "Du kommer!" : "Du har anmält ditt intresse!", "success");
        if (result.blockedWarning) toast(result.blockedWarning, "warning");
        await refreshPanel();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  async function doLeave() {
    const wasInterested = detail?.participationStatus === "interested";
    startTransition(async () => {
      const result = await leaveActivity(activityId);
      if (result.success) {
        toast(
          wasInterested
            ? "Du är inte längre anmäld som intresserad"
            : "Du har avanmält dig",
          "success",
        );
        await refreshPanel();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleLeave() {
    if (detail?.participationStatus === "attending") {
      setShowLeaveConfirm(true);
    } else {
      doLeave();
    }
  }

  async function handleCommentSubmit(_actId: string, content: string) {
    const formData = new FormData();
    formData.set("activityId", activityId);
    formData.set("content", content);
    const result = await createComment(formData);
    if (result.success) {
      await refreshPanel();
    } else {
      toast(result.error ?? "Kunde inte skicka kommentar", "error");
    }
  }

  async function handleCommentDelete(commentId: string) {
    const result = await deleteComment(commentId);
    if (result.success) {
      await refreshPanel();
    }
  }

  const feedbackText =
    detail && detail.feedbackTotal > 0
      ? `${detail.feedbackPositive} av ${detail.feedbackTotal} tyckte det var bra!`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-250 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={detail?.title ?? "Aktivitetsdetalj"}
        tabIndex={-1}
        className={`relative bg-white w-full max-w-[480px] h-full flex flex-col shadow-xl focus:outline-none transition-transform duration-250 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1 rounded-[8px] text-dimmed hover:text-heading hover:bg-primary-light transition-colors"
            aria-label="Stäng"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link
            href={`/activity/${activityId}`}
            className="text-xs text-primary hover:underline"
          >
            Öppna fullständig sida
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="space-y-4">
              <div className="h-8 bg-border rounded animate-pulse" />
              <div className="h-4 bg-border rounded animate-pulse w-2/3" />
              <div className="h-4 bg-border rounded animate-pulse w-1/2" />
              <div className="h-32 bg-border rounded animate-pulse mt-6" />
            </div>
          )}

          {!loading && !detail && (
            <p className="text-secondary text-center py-8">Aktiviteten hittades inte.</p>
          )}

          {!loading && detail && (
            <>
              {/* Image — shown only if uploaded */}
              {detail.imageMediumUrl && (
                <img
                  src={detail.imageMediumUrl}
                  alt=""
                  className="w-full aspect-video object-cover rounded-lg"
                />
              )}

              {/* Title + status badge + metadata */}
              <div>
                {(detail.isCreator || detail.participationStatus) && (
                  <div className="flex justify-end mb-2">
                    {detail.isCreator && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success-bg text-success-text font-semibold text-xs">
                        Du arrangerar
                      </span>
                    )}
                    {!detail.isCreator && detail.participationStatus === "attending" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-light text-primary font-semibold text-xs">
                        Kommer &#10003;
                      </span>
                    )}
                    {!detail.isCreator && detail.participationStatus === "interested" && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-alert-bg text-alert-text font-semibold text-xs">
                        Intresserad
                      </span>
                    )}
                  </div>
                )}
                <h2 className="text-2xl font-bold text-heading">{detail.title}</h2>
                <div className="mt-2 space-y-1 text-sm text-secondary">
                  <p>
                    {new Date(detail.startTime).toLocaleDateString("sv-SE", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {detail.endTime && (
                      <>
                        {" "}&ndash;{" "}
                        {new Date(detail.endTime).toLocaleTimeString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                  <p>{detail.location}</p>
                  <p>
                    Skapad av{" "}
                    <span className="font-medium text-heading">{detail.creatorName}</span>
                  </p>
                </div>

                {detail.latitude && detail.longitude && (
                  <div className="mt-3 rounded-[8px] overflow-hidden border border-border">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${detail.latitude},${detail.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${detail.latitude},${detail.longitude}&zoom=15&size=600x200&scale=2&markers=color:0x3d6b5e%7C${detail.latitude},${detail.longitude}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                        alt={`Karta: ${detail.location}`}
                        className="w-full h-[150px] object-cover"
                      />
                    </a>
                  </div>
                )}

                {detail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-xs px-3 py-1 rounded-full bg-primary-light text-primary font-medium"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Participation */}
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-secondary">
                    Deltagare:{" "}
                    <span className="font-semibold text-heading">
                      {detail.participantCount}
                      {detail.maxParticipants ? ` / ${detail.maxParticipants}` : ""}
                    </span>
                  </span>
                  {feedbackText && (
                    <span className="text-sm text-primary font-medium">{feedbackText}</span>
                  )}
                </div>

                {!detail.isCreator && detail.participationStatus === "attending" && (
                  <Button variant="danger" size="sm" loading={isPending} onClick={handleLeave}>
                    Kan inte komma
                  </Button>
                )}

                {!detail.isCreator && detail.participationStatus === "interested" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button variant="primary" size="sm" loading={isPending} onClick={() => handleJoin("attending")}>
                      Kommer
                    </Button>
                    <Button variant="secondary" size="sm" loading={isPending} onClick={handleLeave}>
                      Ångra
                    </Button>
                  </div>
                )}

                {!detail.isParticipant && !detail.isCreator && !detail.cancelledAt && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button variant="primary" size="sm" loading={isPending} onClick={() => handleJoin("attending")}>
                      Kommer
                    </Button>
                    <Button variant="secondary" size="sm" loading={isPending} onClick={() => handleJoin("interested")}>
                      Intresserad
                    </Button>
                  </div>
                )}

                {detail.isCreator && (
                  <Link href={`/activity/${activityId}/edit`}>
                    <Button variant="secondary" size="sm">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Redigera
                    </Button>
                  </Link>
                )}
              </Card>

              {/* Description */}
              <p className="text-heading whitespace-pre-wrap leading-relaxed">
                {detail.description}
              </p>

              {/* Courage section */}
              {detail.whatToExpect && (
                <CourageSection whatToExpect={detail.whatToExpect as { okAlone?: boolean; experienceLevel?: string; whoComes?: string; latePolicy?: string }} />
              )}

              {/* Comments */}
              <CommentList
                comments={detail.comments}
                activityId={activityId}
                isParticipant={detail.isParticipant}
                isCreator={detail.isCreator}
                currentUserId={detail.currentUserId}
                onSubmit={handleCommentSubmit}
                onDelete={handleCommentDelete}
              />
            </>
          )}
        </div>

        {/* Admin moderation footer — sticky, visible only to non-creator admins on live activities */}
        {detail && detail.viewerIsAdmin && !detail.isCreator && !detail.deletedAt && (
          <div className="shrink-0 bg-info-light border-t-2 border-info/40 px-6 py-3 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.15)]">
            <AdminActivityControls
              activity={{
                id: detail.id,
                title: detail.title,
                description: detail.description,
                location: detail.location,
                startTime: detail.startTime,
                endTime: detail.endTime,
                creatorDisplayName: detail.creatorName,
              }}
              creatorIsAdmin={detail.creatorIsAdmin}
              compact
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showLeaveConfirm}
        onCancel={() => setShowLeaveConfirm(false)}
        onConfirm={() => {
          setShowLeaveConfirm(false);
          doLeave();
        }}
        title="Kan du inte komma?"
        message="Är du säker på att du vill avanmäla dig från aktiviteten?"
        confirmLabel="Ja"
        cancelLabel="Nej"
        variant="danger"
        loading={isPending}
      />
    </div>
  );
}
