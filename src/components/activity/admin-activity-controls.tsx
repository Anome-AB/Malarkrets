"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  adminCancelActivity,
  adminDeleteActivity,
} from "@/actions/admin-moderation";

interface ActivityForEdit {
  id: string;
  title: string;
  creatorDisplayName?: string | null;
}

interface Props {
  activity: ActivityForEdit;
  creatorIsAdmin: boolean;
  compact?: boolean;
}

export function AdminActivityControls({ activity, creatorIsAdmin, compact = false }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [cancelReason, setCancelReason] = useState("");

  const [deleteReason, setDeleteReason] = useState("");
  const [banCreator, setBanCreator] = useState(false);
  const [banReason, setBanReason] = useState("");

  function handleCancel() {
    startTransition(async () => {
      const result = await adminCancelActivity({
        activityId: activity.id,
        reason: cancelReason,
      });
      if (result.success) {
        toast("Aktiviteten har avbokats", "success");
        setCancelOpen(false);
        setCancelReason("");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await adminDeleteActivity({
        activityId: activity.id,
        reason: deleteReason,
        banCreator,
        banReason: banCreator ? banReason : undefined,
      });
      if (result.success) {
        toast("Aktiviteten har tagits bort", "success");
        setDeleteOpen(false);
        setDeleteReason("");
        setBanCreator(false);
        setBanReason("");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  const editHref = `/activity/${activity.id}/edit`;

  return (
    <>
      {compact ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-info uppercase tracking-wider">
            Administration
          </span>
          <div className="flex items-center gap-2">
            <Link href={editHref}>
              <Button variant="secondary" size="compact" type="button">
                Redigera
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setCancelOpen(true)}
              type="button"
            >
              Avboka
            </Button>
            <Button
              variant="danger"
              size="compact"
              onClick={() => setDeleteOpen(true)}
              type="button"
            >
              Ta bort
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold text-info uppercase tracking-wider mb-3">
            Administration
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={editHref}>
              <Button variant="secondary" type="button">
                Redigera som admin
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => setCancelOpen(true)} type="button">
              Avboka
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)} type="button">
              Ta bort
            </Button>
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Avboka aktivitet">
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Aktiviteten markeras som inställd. Arrangör och alla deltagare får en notis.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-cancel-reason" className="text-sm font-medium text-heading">
              Anledning <span className="text-error">*</span>
            </label>
            <textarea
              id="admin-cancel-reason"
              rows={3}
              placeholder="Beskriv varför aktiviteten avbokas (minst 10 tecken)"
              className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCancelOpen(false)} type="button">
              Avbryt
            </Button>
            <Button variant="primary" onClick={handleCancel} loading={isPending} type="button">
              Avboka
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete dialog */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Ta bort aktivitet">
        <div className="space-y-4">
          <div className="bg-alert-bg border border-alert-border rounded-control p-3">
            <p className="text-sm text-alert-text font-semibold">
              Aktiviteten döljs från appen
            </p>
            <p className="text-xs text-alert-text mt-1">
              Posten sparas för granskning och kan återställas av en admin via databasen.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-delete-reason" className="text-sm font-medium text-heading">
              Anledning <span className="text-error">*</span>
            </label>
            <textarea
              id="admin-delete-reason"
              rows={3}
              placeholder="Beskriv varför aktiviteten tas bort (minst 10 tecken)"
              className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              required
            />
          </div>

          {!creatorIsAdmin && (
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={banCreator}
                  onChange={(e) => setBanCreator(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-sm text-heading">
                  Stäng även av arrangören{" "}
                  {activity.creatorDisplayName && (
                    <span className="font-medium">({activity.creatorDisplayName})</span>
                  )}
                </span>
              </label>
              {banCreator && (
                <div className="flex flex-col gap-1 mt-3">
                  <label htmlFor="admin-ban-reason" className="text-sm font-medium text-heading">
                    Anledning för avstängning <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="admin-ban-reason"
                    rows={2}
                    placeholder="Beskriv varför användaren stängs av"
                    className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          {creatorIsAdmin && (
            <p className="text-xs text-dimmed">
              Arrangören är admin och kan inte stängas av via moderation. Demota användaren via databasen först.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} type="button">
              Avbryt
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={isPending} type="button">
              Ta bort
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
