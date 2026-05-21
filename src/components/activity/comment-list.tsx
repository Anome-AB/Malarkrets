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
   * Sätts av server-render när författaren har redigerat sin kommentar.
   * UI:t visar då en diskret "(redigerad)"-markör efter tidsstämpeln.
   */
  editedAt?: Date | string | null;
  /**
   * Sätts när kommentaren tagits bort (av författaren själv eller en admin).
   * Tombstone renderas så det syns att en kommentar funnits där.
   */
  deletedAt?: Date | string | null;
  /**
   * Sätts BARA när en admin tagit bort kommentaren. Avgör tombstone-text:
   * admin > arrangör > användaren själv.
   */
  deletedByAdminId?: string | null;
  /**
   * Sätts BARA när aktivitetens arrangör tagit bort en deltagar-kommentar.
   * Mutuellt exklusivt med deletedByAdminId.
   */
  deletedByCreatorId?: string | null;
  /**
   * Sätts av server-render när författaren är blockerad av viewer. Visas
   * som en "Blockerad"-chip - innehållet visas dock som vanligt (ingen
   * spoiler-blur).
   */
  isBlockedByViewer?: boolean;
}

interface CommentListProps {
  comments: Comment[];
  activityId: string;
  isParticipant: boolean;
  isCreator: boolean;
  currentUserId?: string;
  /** Admins får ta bort vilken kommentar som helst (lämnar tombstone). */
  currentUserIsAdmin?: boolean;
  onSubmit?: (activityId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  /** Anropas när författaren sparar en redigerad kommentar. */
  onEdit?: (commentId: string, content: string) => Promise<boolean>;
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
  currentUserIsAdmin = false,
  onSubmit,
  onDelete,
  onEdit,
}: CommentListProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [newComment, setNewComment] = useState("");
  // Centralt block- och delete-state så vi har en ConfirmDialog för hela
  // listan istället för en per kommentar. Avblockering går utan dialog
  // (konstruktiv handling).
  const [blockTarget, setBlockTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    isOwn: boolean;
  } | null>(null);
  const [isBlocking, startBlockTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

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

  function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    startDeleteTransition(() => {
      // Föräldern (panel/detail-client) sköter själva API-anropet och
      // refresh. Vi stänger dialogen direkt - eventuellt fel landar i toast
      // som föräldern triggar.
      onDelete?.(target.id);
      setDeleteTarget(null);
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
            const isOwn = comment.userId === currentUserId;
            // Författaren kan alltid ta bort sin egen. Arrangör och admin
            // kan ta bort andras. Admin-borttagning lämnar tombstone;
            // arrangörens är hard-delete (etablerat beteende).
            const canDelete =
              isOwn || isCreator || currentUserIsAdmin;
            const canEdit = isOwn;
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                canDelete={canDelete}
                canEdit={canEdit}
                isOwn={isOwn}
                currentUserId={currentUserId}
                isBlocking={isBlocking}
                onRequestDelete={() =>
                  setDeleteTarget({ id: comment.id, isOwn })
                }
                onEdit={onEdit}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Ta bort kommentar?"
        message={
          deleteTarget?.isOwn
            ? "Din kommentar ersätts med 'Kommentar borttagen av användaren'. Andra deltagare ser då att det funnits en kommentar där, men inte innehållet."
            : "Kommentaren ersätts med en notis om att en administratör tagit bort den. Författaren kan se att den blivit borttagen."
        }
        confirmLabel="Ta bort"
        cancelLabel="Avbryt"
        variant="danger"
        loading={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

/**
 * En enskild kommentar. Hanterar visningslägen:
 * - Tombstone när admin tagit bort kommentaren (deletedByAdminId set)
 * - Inline-editor när författaren klickat edit
 * - Vanlig visning annars
 */
function CommentItem({
  comment,
  canDelete,
  canEdit,
  isOwn,
  currentUserId,
  isBlocking,
  onRequestDelete,
  onEdit,
  onRequestBlock,
  onUnblock,
}: {
  comment: Comment;
  canDelete: boolean;
  canEdit: boolean;
  isOwn: boolean;
  currentUserId?: string;
  isBlocking: boolean;
  onRequestDelete: () => void;
  onEdit?: (commentId: string, content: string) => Promise<boolean>;
  onRequestBlock: (comment: Comment) => void;
  onUnblock: (comment: Comment) => void;
}) {
  const isTombstoned = !!comment.deletedAt;
  const removedByAdmin = !!comment.deletedByAdminId;
  const removedByCreator = !comment.deletedByAdminId && !!comment.deletedByCreatorId;
  const isBlocked = !!comment.isBlockedByViewer;
  const isEdited = !!comment.editedAt;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [isSaving, startSaveTransition] = useTransition();

  // Block/unblock-knappen visas bara för inloggade, mot andra användare,
  // och bara om författaren fortfarande har konto (userId != null) och
  // kommentaren inte är borttagen.
  const canBlockOrUnblock =
    !isTombstoned &&
    !!currentUserId &&
    comment.userId !== null &&
    comment.userId !== currentUserId;

  function startEdit() {
    setEditText(comment.content);
    setIsEditing(true);
  }
  function cancelEdit() {
    setIsEditing(false);
    setEditText(comment.content);
  }
  function saveEdit() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.content || !onEdit) {
      setIsEditing(false);
      return;
    }
    startSaveTransition(async () => {
      const ok = await onEdit(comment.id, trimmed);
      if (ok) setIsEditing(false);
    });
  }

  // ─── Tombstone-rendering ───
  if (isTombstoned) {
    return (
      <li className="bg-muted border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-secondary truncate">
            {comment.authorName}
          </span>
          <span className="shrink-0 text-xs text-dimmed">
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-secondary italic">
          {removedByAdmin
            ? "Kommentar borttagen av administratör"
            : removedByCreator
              ? "Kommentar borttagen av arrangör"
              : "Kommentar borttagen av användaren"}
        </p>
      </li>
    );
  }

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
          {isEdited && (
            <span className="shrink-0 text-xs text-dimmed italic">
              (redigerad)
            </span>
          )}
        </div>
        {!isEditing && (
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
            {canEdit && (
              <button
                type="button"
                onClick={startEdit}
                className="p-1 rounded-control text-dimmed hover:text-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
                aria-label={`Redigera din kommentar`}
                title="Redigera"
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
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                onClick={onRequestDelete}
                className="p-1 rounded-control text-dimmed hover:text-warning transition-colors"
                aria-label={
                  isOwn
                    ? "Ta bort din kommentar"
                    : `Ta bort kommentar av ${comment.authorName}`
                }
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
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            maxLength={2000}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm text-heading focus:outline-none focus:border-primary resize-y"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
            >
              Avbryt
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={saveEdit}
              loading={isSaving}
              disabled={
                !editText.trim() || editText.trim() === comment.content
              }
            >
              Spara
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-heading whitespace-pre-wrap">
          {comment.content}
        </p>
      )}
    </li>
  );
}
