"use client";

import { useState } from "react";

interface Comment {
  id: string;
  userId: string | null;
  authorName: string;
  content: string;
  createdAt: Date | string;
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
  const [newComment, setNewComment] = useState("");

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
              <li
                key={comment.id}
                className="bg-white border border-border rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-heading">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-secondary">
                      {timeAgo(comment.createdAt)}
                    </span>
                  </div>
                  {canDelete && (
                    <button
                      onClick={() => onDelete?.(comment.id)}
                      className="text-xs text-dimmed hover:text-warning transition-colors"
                      aria-label={`Ta bort kommentar av ${comment.authorName}`}
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
                <p className="text-sm text-heading">{comment.content}</p>
              </li>
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
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Skicka
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-secondary bg-background border border-border rounded-lg p-3 text-center">
          Anmäl intresse för att kommentera
        </p>
      )}
    </section>
  );
}
