"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { blockUser, unblockUser } from "@/actions/blocking";

interface Comment {
  id: string;
  userId: string | null;
  authorName: string;
  content: string;
  createdAt: Date | string;
  /**
   * Sätts av server-render när författaren är blockerad av viewer. UI:t
   * renderar kommentaren som en spoiler - suddig text + "Visa"-knapp tills
   * användaren själv väljer att avslöja innehållet.
   */
  isBlockedByViewer?: boolean;
}

interface CommentListProps {
  comments: Comment[];
  activityId: string;
  isParticipant: boolean;
  isCreator: boolean;
  currentUserId?: string;
  onSubmit?: (activityId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
}

function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just nu";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min sedan`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dagar sedan`;
  return then.toLocaleDateString("sv-SE");
}

export function CommentList({
  comments,
  activityId,
  isParticipant,
  isCreator,
  currentUserId,
  onSubmit,
  onDelete,
}: CommentListProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [newComment, setNewComment] = useState("");
  // Centralt block-state så vi har en ConfirmDialog för hela listan istället
  // för en per kommentar. Avblockering går utan dialog (konstruktiv handling).
  const [blockTarget, setBlockTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isBlocking, startBlockTransition] = useTransition();

  function confirmBlock() {
    const target = blockTarget;
    if (!target) return;
    startBlockTransition(async () => {
      const result = await blockUser(target.id);
      if (result.success) {
        toast(`${target.name} är nu blockerad`, "success");
        setBlockTarget(null);
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleUnblock(userId: string, name: string) {
    startBlockTransition(async () => {
      const result = await unblockUser(userId);
      if (result.success) {
        toast(`${name} är avblockerad`, "success");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
    onSubmit?.(activityId, trimmed);
    setNewComment("");
  }

  return (
    <section aria-labelledby="comments-heading">
      <h3
        id="comments-heading"
        className="text-base font-semibold text-heading mb-3"
      >
        Kommentarer
      </h3>

      {comments.length === 0 ? (
        <p className="text-sm text-secondary italic">
          Inga kommentarer ännu. Bli den första!
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const canDelete =
              isCreator || comment.userId === currentUserId;
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                canDelete={canDelete}
                currentUserId={currentUserId}
                isBlocking={isBlocking}
                onDelete={onDelete}
                onRequestBlock={(c) =>
                  setBlockTarget({ id: c.userId!, name: c.authorName })
                }
                onUnblock={(c) => handleUnblock(c.userId!, c.authorName)}
              />
            );
          })}
        </ul>
      )}

      {isParticipant ? (
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Ställ en fråga till arrangören..."
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm text-heading placeholder:text-dimmed focus:outline-none focus:border-primary"
          />
          <Button type="submit" disabled={!newComment.trim()}>
            Skicka
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-secondary bg-background border border-border rounded-lg p-3 text-center">
          Anmäl intresse för att kommentera
        </p>
      )}

      <ConfirmDialog
        open={!!blockTarget}
        title={blockTarget ? `Blockera ${blockTarget.name}?` : ""}
        message={
          blockTarget
            ? `Du ser inte längre aktiviteter som ${blockTarget.name} arrangerar i flödet, och de ser inte dina. Ni kan dock fortfarande delta i samma aktiviteter som någon annan arrangerar - där syns ni kvar i deltagarlistan. Du kan avblockera när som helst senare.`
            : ""
        }
        confirmLabel="Blockera"
        cancelLabel="Avbryt"
        variant="danger"
        loading={isBlocking}
        onCancel={() => setBlockTarget(null)}
        onConfirm={confirmBlock}
      />
    </section>
  );
}

/**
 * En enskild kommentar. Blockerade författares texter renderas som spoiler
 * - innehållet suddigt + osökbart, med en Visa-knapp som avslöjar texten.
 * Avslöjat tillstånd är per-render (försvinner vid reload) så användaren
 * inte permanent har bjudit in obekväma kommentarer i sin vy.
 */
function CommentItem({
  comment,
  canDelete,
  currentUserId,
  isBlocking,
  onDelete,
  onRequestBlock,
  onUnblock,
}: {
  comment: Comment;
  canDelete: boolean;
  currentUserId?: string;
  isBlocking: boolean;
  onDelete?: (commentId: string) => void;
  onRequestBlock: (comment: Comment) => void;
  onUnblock: (comment: Comment) => void;
}) {
  const isBlocked = !!comment.isBlockedByViewer;
  const [revealed, setRevealed] = useState(false);
  const shouldBlur = isBlocked && !revealed;
  // Block/unblock-knappen visas bara för inloggade, mot andra användare,
  // och bara om författaren fortfarande har konto (userId != null).
  const canBlockOrUnblock =
    !!currentUserId &&
    comment.userId !== null &&
    comment.userId !== currentUserId;

  return (
    <li className="bg-white border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-heading truncate">
            {comment.authorName}
          </span>
          {isBlocked && (
            <span className="shrink-0 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-error">
              Blockerad
            </span>
          )}
          <span className="shrink-0 text-xs text-secondary">
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          {canBlockOrUnblock && !isBlocked && (
            <button
              type="button"
              onClick={() => onRequestBlock(comment)}
              disabled={isBlocking}
              aria-label={`Blockera ${comment.authorName}`}
              title="Blockera"
              className="p-1 rounded-control text-error/70 hover:text-error hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-error disabled:opacity-50 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            </button>
          )}
          {canBlockOrUnblock && isBlocked && (
            <button
              type="button"
              onClick={() => onUnblock(comment)}
              disabled={isBlocking}
              aria-label={`Avblockera ${comment.authorName}`}
              title="Avblockera"
              className="p-1 rounded-control text-secondary hover:text-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete?.(comment.id)}
              className="p-1 rounded-control text-dimmed hover:text-warning transition-colors"
              aria-label={`Ta bort kommentar av ${comment.authorName}`}
              title="Ta bort"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p
        className={`text-sm text-heading transition-[filter] duration-200 ${
          shouldBlur ? "blur-sm select-none pointer-events-none" : ""
        }`}
        aria-hidden={shouldBlur}
      >
        {comment.content}
      </p>
      {isBlocked && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="mt-1.5 text-xs text-primary hover:underline focus:outline-none focus:underline"
        >
          {revealed ? "Dölj kommentar" : "Visa kommentar"}
        </button>
      )}
    </li>
  );
}
