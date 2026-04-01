"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CourageSection } from "@/components/activity/courage-section";
import { CommentList } from "@/components/activity/comment-list";
import { useToast } from "@/components/ui/toast";
import { joinActivity, leaveActivity, getActivityDetail } from "@/actions/activities";
import { createComment, deleteComment } from "@/actions/comments";

interface ActivityDetail {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date | string;
  endTime: Date | string | null;
  maxParticipants: number | null;
  cancelledAt: Date | string | null;
  imageMediumUrl: string | null;
  whatToExpect: Record<string, unknown> | null;
  creatorId: string | null;
  creatorName: string;
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
  isCreator: boolean;
  currentUserId: string;
}

interface ActivityPanelProps {
  activityId: string;
  open: boolean;
  onClose: () => void;
}

export function ActivityPanel({ activityId, open, onClose }: ActivityPanelProps) {
  const router = useRouter();
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
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

  async function handleJoin() {
    startTransition(async () => {
      const result = await joinActivity(activityId, "attending");
      if (result.success) {
        toast("Du är anmäld!", "success");
        if (result.blockedWarning) toast(result.blockedWarning, "warning");
        const updated = await getActivityDetail(activityId);
        setDetail(updated as ActivityDetail | null);
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  async function handleLeave() {
    startTransition(async () => {
      const result = await leaveActivity(activityId);
      if (result.success) {
        toast("Du har avanmält dig", "success");
        const updated = await getActivityDetail(activityId);
        setDetail(updated as ActivityDetail | null);
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  async function handleCommentSubmit(_actId: string, content: string) {
    const formData = new FormData();
    formData.set("activityId", activityId);
    formData.set("content", content);
    const result = await createComment(formData);
    if (result.success) {
      const updated = await getActivityDetail(activityId);
      setDetail(updated as ActivityDetail | null);
    } else {
      toast(result.error ?? "Kunde inte skicka kommentar", "error");
    }
  }

  async function handleCommentDelete(commentId: string) {
    const result = await deleteComment(commentId);
    if (result.success) {
      const updated = await getActivityDetail(activityId);
      setDetail(updated as ActivityDetail | null);
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
        className={`relative bg-white w-full max-w-[480px] h-full overflow-y-auto shadow-xl focus:outline-none transition-transform duration-250 ease-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#dddddd] px-6 py-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1 rounded-[8px] text-[#999999] hover:text-[#2d2d2d] hover:bg-[#e8f0ec] transition-colors"
            aria-label="Stäng"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link
            href={`/activity/${activityId}`}
            className="text-xs text-[#3d6b5e] hover:underline"
          >
            Öppna fullständig sida
          </Link>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="space-y-4">
              <div className="h-8 bg-[#e8e8e8] rounded animate-pulse" />
              <div className="h-4 bg-[#e8e8e8] rounded animate-pulse w-2/3" />
              <div className="h-4 bg-[#e8e8e8] rounded animate-pulse w-1/2" />
              <div className="h-32 bg-[#e8e8e8] rounded animate-pulse mt-6" />
            </div>
          )}

          {!loading && !detail && (
            <p className="text-[#666666] text-center py-8">Aktiviteten hittades inte.</p>
          )}

          {!loading && detail && (
            <>
              {/* Image */}
              {detail.imageMediumUrl && (
                <img
                  src={detail.imageMediumUrl}
                  alt=""
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}

              {/* Title + metadata */}
              <div>
                <h2 className="text-2xl font-bold text-[#2d2d2d]">{detail.title}</h2>
                <div className="mt-2 space-y-1 text-sm text-[#666666]">
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
                    <span className="font-medium text-[#2d2d2d]">{detail.creatorName}</span>
                  </p>
                </div>

                {detail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {detail.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="text-xs px-3 py-1 rounded-full bg-[#e8f0ec] text-[#3d6b5e] font-medium"
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
                  <span className="text-sm text-[#666666]">
                    Deltagare:{" "}
                    <span className="font-semibold text-[#2d2d2d]">
                      {detail.participantCount}
                      {detail.maxParticipants ? ` / ${detail.maxParticipants}` : ""}
                    </span>
                  </span>
                  {feedbackText && (
                    <span className="text-sm text-[#3d6b5e] font-medium">{feedbackText}</span>
                  )}
                </div>

                {detail.isParticipant && (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e8f0ec] text-[#3d6b5e] font-semibold text-sm">
                      Du är anmäld &#10003;
                    </span>
                    <Button variant="secondary" size="sm" loading={isPending} onClick={handleLeave}>
                      Avanmäl
                    </Button>
                  </div>
                )}

                {!detail.isParticipant && !detail.isCreator && !detail.cancelledAt && (
                  <Button variant="primary" loading={isPending} onClick={handleJoin} className="w-full">
                    Jag vill vara med!
                  </Button>
                )}

                {detail.isCreator && (
                  <Link
                    href={`/activity/${activityId}/edit`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-[#3d6b5e] border border-[#3d6b5e] rounded-[8px] hover:bg-[#e8f0ec] transition-colors"
                  >
                    Redigera
                  </Link>
                )}
              </Card>

              {/* Description */}
              <p className="text-[#2d2d2d] whitespace-pre-wrap leading-relaxed">
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
      </div>
    </div>
  );
}
