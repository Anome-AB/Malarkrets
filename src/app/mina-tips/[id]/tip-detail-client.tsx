"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  editMyTip,
  addTipComment,
  type MyTipDetail,
  type TipComment,
} from "@/actions/feedback-tips";

type Kind = "bug" | "idea";

const STATUS_LABEL: Record<MyTipDetail["status"], string> = {
  open: "Inkommit",
  triaged: "Vi har sett det",
  in_progress: "På gång",
  done: "Klart",
  wont_fix: "Vi tar inte det här",
  duplicate: "Samma som ett annat tips",
};

const STATUS_DOT: Record<MyTipDetail["status"], string> = {
  open: "bg-border",
  triaged: "bg-accent",
  in_progress: "bg-primary",
  done: "bg-primary",
  wont_fix: "bg-secondary",
  duplicate: "bg-secondary",
};

interface TipDetailClientProps {
  tip: MyTipDetail;
}

export function TipDetailClient({ tip }: TipDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editKind, setEditKind] = useState<Kind>(tip.kind);
  const [editDescription, setEditDescription] = useState(tip.description);
  const [commentBody, setCommentBody] = useState("");
  const [saving, startSaving] = useTransition();

  function handleSaveEdit() {
    if (editDescription.trim().length < 10) {
      toast("Skriv minst 10 tecken", "warning");
      return;
    }
    startSaving(async () => {
      const result = await editMyTip({
        tipId: tip.id,
        kind: editKind,
        description: editDescription.trim(),
      });
      if (result.success) {
        setEditing(false);
        toast("Sparat", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleAddComment() {
    if (commentBody.trim().length === 0) return;
    startSaving(async () => {
      const result = await addTipComment({
        tipId: tip.id,
        body: commentBody.trim(),
      });
      if (result.success) {
        setCommentBody("");
        toast("Svar skickat", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-heading">
              <span className="text-xl" aria-hidden="true">
                {tip.kind === "bug" ? "🐞" : "💡"}
              </span>
              <span>{tip.kind === "bug" ? "Bugg" : "Förslag"}</span>
            </div>
            <span className="text-xs text-secondary font-mono">
              {new Date(tip.createdAt).toLocaleString("sv-SE")}
            </span>
          </div>

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <KindRadio
                  value="bug"
                  current={editKind}
                  onSelect={setEditKind}
                  emoji="🐞"
                  label="Något fungerar inte"
                />
                <KindRadio
                  value="idea"
                  current={editKind}
                  onSelect={setEditKind}
                  emoji="💡"
                  label="Ett förslag"
                />
              </div>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={6}
                className="w-full rounded-control border border-border px-4 py-3 text-base text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                maxLength={8000}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="compact"
                  onClick={() => {
                    setEditing(false);
                    setEditKind(tip.kind);
                    setEditDescription(tip.description);
                  }}
                  disabled={saving}
                >
                  Avbryt
                </Button>
                <Button
                  type="button"
                  size="compact"
                  onClick={handleSaveEdit}
                  loading={saving}
                >
                  Spara
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-heading whitespace-pre-wrap">{tip.description}</p>
              {tip.canEdit && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="compact"
                    onClick={() => setEditing(true)}
                  >
                    Redigera
                  </Button>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-border-light">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[tip.status]}`}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-heading">
              {STATUS_LABEL[tip.status]}
            </span>
          </div>

          {tip.adminNotes && (
            <div className="rounded-control bg-primary-light px-4 py-3 text-sm text-heading">
              <span className="font-semibold">
                Sammanfattning från{" "}
                {tip.adminNotesAuthorName ?? "Mälarkrets"}:
              </span>{" "}
              {tip.adminNotes}
            </div>
          )}
        </div>
      </Card>

      <Card title={`Konversation (${tip.commentCount})`}>
        {tip.comments.length === 0 ? (
          <p className="text-sm text-secondary py-4 text-center">
            Inga svar ännu. Vi hör av oss om vi behöver veta mer.
          </p>
        ) : (
          <ul className="space-y-3">
            {tip.comments.map((c) => (
              <CommentBubble key={c.id} comment={c} viewerIsReporter={true} />
            ))}
          </ul>
        )}

        <div className="mt-4 pt-4 border-t border-border-light space-y-3">
          <label
            htmlFor="comment-body"
            className="block text-sm font-medium text-heading"
          >
            Skriv ett svar
          </label>
          <textarea
            id="comment-body"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            placeholder="Lägg till mer info eller svara på en följdfråga..."
            className="w-full rounded-control border border-border px-4 py-2 text-base text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              size="compact"
              onClick={handleAddComment}
              loading={saving}
              disabled={commentBody.trim().length === 0}
            >
              Skicka svar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface KindRadioProps {
  value: Kind;
  current: Kind;
  onSelect: (k: Kind) => void;
  emoji: string;
  label: string;
}

function KindRadio({ value, current, onSelect, emoji, label }: KindRadioProps) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={`
        flex items-center gap-2 rounded-control border-2 px-3 py-2 text-left text-sm
        transition-colors min-h-touch-target
        ${selected
          ? "border-primary bg-primary-light text-heading"
          : "border-border bg-white text-heading hover:border-primary hover:bg-primary-light/50"}
      `}
    >
      <span className="text-lg" aria-hidden="true">{emoji}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

interface CommentBubbleProps {
  comment: TipComment;
  viewerIsReporter: boolean;
}

export function CommentBubble({ comment, viewerIsReporter }: CommentBubbleProps) {
  const fromMe = viewerIsReporter ? comment.isReporter : !comment.isReporter;
  const name = comment.authorIsAdmin
    ? `${comment.authorDisplayName ?? "Admin"} (admin)`
    : comment.authorDisplayName ?? "Testare";

  return (
    <li className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-card px-4 py-3 ${
          fromMe ? "bg-primary-light" : "bg-background border border-border"
        }`}
      >
        <div className="flex items-center gap-2 mb-1 text-xs text-secondary">
          <span className="font-medium text-heading">{name}</span>
          <span className="font-mono">
            {new Date(comment.createdAt).toLocaleString("sv-SE", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </div>
        <p className="text-sm text-heading whitespace-pre-wrap">{comment.body}</p>
      </div>
    </li>
  );
}
