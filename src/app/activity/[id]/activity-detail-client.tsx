"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  function handleLeave() {
    setLeaving(true);
    startTransition(async () => {
      const result = await leaveActivity(activityId);
      setLeaving(false);
      if (result.success) {
        toast("Du har avanmält dig", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleJoin(status: "attending" | "interested") {
    setJoining(true);
    startTransition(async () => {
      const result = await joinActivity(activityId, status);
      setJoining(false);
      if (result.success) {
        toast(
          status === "attending" ? "Du har anmält dig!" : "Du är markerad som intresserad!",
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

  return (
    <div className="space-y-8">
      {/* Join / Auth buttons — hidden for cancelled activities */}
      {!isCancelled && (
        <>
          {!isAuthenticated && (
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#3d6b5e] text-white font-semibold rounded-lg hover:bg-[#345c51] transition-colors"
            >
              Logga in för att delta
            </Link>
          )}

          {isAuthenticated && participationStatus === "attending" && (
            <Button
              variant="secondary"
              size="sm"
              loading={leaving}
              onClick={handleLeave}
            >
              Avanmäl
            </Button>
          )}

          {isAuthenticated && participationStatus === "interested" && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#fff3cd] text-[#856404] font-semibold text-sm">
                Intresserad
              </span>
              <Button variant="primary" size="sm" loading={joining} onClick={() => handleJoin("attending")}>
                Anmäl mig
              </Button>
              <Button variant="secondary" size="sm" loading={leaving} onClick={handleLeave}>
                Ta bort
              </Button>
            </div>
          )}

          {isAuthenticated && !isParticipant && !isCreator && (
            <div className="flex gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={joining}
                onClick={() => handleJoin("attending")}
              >
                Jag vill vara med!
              </Button>
              <Button
                variant="secondary"
                size="lg"
                loading={joining}
                onClick={() => handleJoin("interested")}
              >
                Intresserad
              </Button>
            </div>
          )}
        </>
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
  );
}
