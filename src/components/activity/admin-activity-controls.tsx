"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  adminEditActivity,
  adminCancelActivity,
  adminDeleteActivity,
} from "@/actions/admin-moderation";

interface ActivityForEdit {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: Date | string;
  endTime: Date | string | null;
  creatorDisplayName?: string | null;
}

interface Props {
  activity: ActivityForEdit;
  creatorIsAdmin: boolean;
  compact?: boolean;
}

function toLocalInput(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  // yyyy-MM-ddTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AdminActivityControls({ activity, creatorIsAdmin, compact = false }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Edit form state
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [location, setLocation] = useState(activity.location);
  const [startTime, setStartTime] = useState(toLocalInput(activity.startTime));
  const [endTime, setEndTime] = useState(toLocalInput(activity.endTime));
  const [editReason, setEditReason] = useState("");

  // Cancel form state
  const [cancelReason, setCancelReason] = useState("");

  // Delete form state
  const [deleteReason, setDeleteReason] = useState("");
  const [banCreator, setBanCreator] = useState(false);
  const [banReason, setBanReason] = useState("");

  function handleEdit() {
    const patch: Record<string, string> = {};
    if (title !== activity.title) patch.title = title;
    if (description !== activity.description) patch.description = description;
    if (location !== activity.location) patch.location = location;
    const origStart = toLocalInput(activity.startTime);
    if (startTime !== origStart) patch.startTime = new Date(startTime).toISOString();
    const origEnd = toLocalInput(activity.endTime);
    if (endTime !== origEnd) {
      patch.endTime = endTime ? new Date(endTime).toISOString() : "";
    }

    if (Object.keys(patch).length === 0) {
      toast("Inga ändringar att spara", "warning");
      return;
    }

    startTransition(async () => {
      const result = await adminEditActivity({
        activityId: activity.id,
        reason: editReason,
        patch,
      });
      if (result.success) {
        toast("Aktiviteten har redigerats och arrangören notifierats", "success");
        setEditOpen(false);
        setEditReason("");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

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

  return (
    <>
      {compact ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-info uppercase tracking-wider">
            Administration
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => setEditOpen(true)}
              type="button"
            >
              Redigera
            </Button>
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
        <div className="border-t border-border pt-4 mt-4">
          <p className="text-xs font-semibold text-dimmed uppercase tracking-wide mb-2">
            Administration
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)} type="button">
              Redigera som admin
            </Button>
            <Button variant="secondary" onClick={() => setCancelOpen(true)} type="button">
              Avboka
            </Button>
            <Button variant="danger" onClick={() => setDeleteOpen(true)} type="button">
              Ta bort
            </Button>
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Redigera aktivitet som admin">
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Arrangören får en notis med anledningen och de fält som ändrats.
          </p>
          <Input
            label="Titel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-edit-desc" className="text-sm font-medium text-heading">
              Beskrivning
            </label>
            <textarea
              id="admin-edit-desc"
              rows={4}
              className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Input
            label="Plats"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Starttid"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="Sluttid"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-edit-reason" className="text-sm font-medium text-heading">
              Anledning till ändring <span className="text-error">*</span>
            </label>
            <textarea
              id="admin-edit-reason"
              rows={2}
              placeholder="Beskriv varför du redigerar (minst 10 tecken)"
              className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)} type="button">
              Avbryt
            </Button>
            <Button variant="primary" onClick={handleEdit} loading={isPending} type="button">
              Spara ändringar
            </Button>
          </div>
        </div>
      </Modal>

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
                    className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
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
