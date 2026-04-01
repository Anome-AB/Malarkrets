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
  isCreator: boolean;
  currentUserId: string | null;
  comments: Comment[];
}

export function ActivityDetailClient({
  activityId,
  isAuthenticated,
  isParticipant,
  isCreator,
  currentUserId,
  comments,
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
        toast("Du har avanmalt dig", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Nagot gick fel", "error");
      }
    });
  }

  function handleJoin() {
    setJoining(true);
    startTransition(async () => {
      const result = await joinActivity(activityId, "attending");
      setJoining(false);
      if (result.success) {
        toast("Du har anmält dig!", "success");
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
      {/* Join / Auth buttons */}
      {!isAuthenticated && (
        <Link
          href="/auth/login"
          className="inline-flex items-center justify-center px-6 py-3 bg-[#3d6b5e] text-white font-semibold rounded-lg hover:bg-[#345c51] transition-colors"
        >
          Logga in för att delta
        </Link>
      )}

      {isAuthenticated && isParticipant && (
        <Button
          variant="secondary"
          size="sm"
          loading={leaving}
          onClick={handleLeave}
        >
          Avanmal
        </Button>
      )}

      {isAuthenticated && !isParticipant && !isCreator && (
        <Button
          variant="primary"
          size="lg"
          loading={joining}
          onClick={handleJoin}
        >
          Jag vill vara med!
        </Button>
      )}

      {/* Comments */}
      {isAuthenticated && (
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
