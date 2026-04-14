"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CommentList } from "@/components/activity/comment-list";
import { useToast } from "@/components/ui/toast";
import { joinActivity, leaveActivity } from "@/actions/activities";
import { createComment, deleteComment } from "@/actions/comments";

interface Comment {
  id: string;
  userId: string | null;
  authorName: string;
  content: string;
  createdAt: Date | string;
}

interface ActivityDetailClientProps {
  activityId: string;
  isAuthenticated: boolean;
  isParticipant: boolean;
  participationStatus: "interested" | "attending" | null;
  isCreator: boolean;
  currentUserId: string | null;
  comments: Comment[];
  isCancelled?: boolean;
}

export function ActivityDetailClient({
  activityId,
  isAuthenticated,
  isParticipant,
  participationStatus,
  isCreator,
  currentUserId,
  comments,
  isCancelled,
}: ActivityDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  function doLeave() {
    setLeaving(true);
    startTransition(async () => {
      const result = await leaveActivity(activityId);
      setLeaving(false);
      if (result.success) {
        toast(
          participationStatus === "interested"
            ? "Du är inte längre anmäld som intresserad"
            : "Du har avanmält dig",
          "success",
        );
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleLeave() {
    // Only confirm for attending (not interested — they can ångra freely)
    if (participationStatus === "attending") {
      setShowLeaveConfirm(true);
    } else {
      doLeave();
    }
  }

  function handleJoin(status: "attending" | "interested") {
    setJoining(true);
    startTransition(async () => {
      const result = await joinActivity(activityId, status);
      setJoining(false);
      if (result.success) {
        toast(
          status === "attending" ? "Du har anmält dig!" : "Du har anmält ditt intresse!",
          "success",
        );
        if (result.blockedWarning) {
          toast(result.blockedWarning, "warning");
        }
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  async function handleCommentSubmit(actId: string, content: string) {
    const formData = new FormData();
    formData.set("activityId", actId);
    formData.set("content", content);
    const result = await createComment(formData);
    if (result.success) {
      router.refresh();
    } else {
      toast(result.error ?? "Kunde inte skicka kommentar", "error");
    }
  }

  async function handleCommentDelete(commentId: string) {
    const result = await deleteComment(commentId);
    if (result.success) {
      router.refresh();
    } else {
      toast(result.error ?? "Kunde inte ta bort kommentar", "error");
    }
  }

  const actionButtons = !isCancelled && (
    <>
      {!isAuthenticated && (
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
        >
          Logga in för att delta
        </Link>
      )}

      {isAuthenticated && participationStatus === "attending" && (
        <Button variant="secondary" loading={leaving} onClick={handleLeave}>
          Kan inte komma
        </Button>
      )}

      {isAuthenticated && participationStatus === "interested" && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="primary" loading={joining} onClick={() => handleJoin("attending")}>
            Kommer
          </Button>
          <Button variant="secondary" loading={leaving} onClick={handleLeave}>
            Ångra
          </Button>
        </div>
      )}

      {isAuthenticated && !isParticipant && !isCreator && (
        <div className="flex gap-3">
          <Button
            variant="primary"
            loading={joining}
            onClick={() => handleJoin("attending")}
          >
            Kommer
          </Button>
          <Button
            variant="secondary"
            loading={joining}
            onClick={() => handleJoin("interested")}
          >
            Intresserad
          </Button>
        </div>
      )}
    </>
  );

  return (
    <>
      <div className="space-y-8">
        {/* Inline action buttons — desktop only */}
        {!isCancelled && (
          <div className="hidden lg:block">{actionButtons}</div>
        )}

        {/* Comments — hidden for cancelled activities */}
        {isAuthenticated && !isCancelled && (
          <CommentList
            comments={comments}
            activityId={activityId}
            isParticipant={isParticipant || isCreator}
            isCreator={isCreator}
            currentUserId={currentUserId ?? undefined}
            onSubmit={handleCommentSubmit}
            onDelete={handleCommentDelete}
          />
        )}
      </div>

      {/* Floating CTA bar — mobile only, above BottomNav */}
      {!isCancelled && actionButtons && (
        <div className="fixed bottom-[56px] left-0 right-0 lg:hidden bg-white border-t border-border px-4 py-3 z-40 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 [&>div]:flex-wrap [&>div]:w-full [&_button]:flex-1 [&_a]:flex-1 [&_a]:text-center">
            {actionButtons}
          </div>
        </div>
      )}

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
        loading={leaving}
      />
    </>
  );
}
