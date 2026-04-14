"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface CancelActivityModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  participantCount: number;
  loading: boolean;
}

export function CancelActivityModal({
  open,
  onClose,
  onConfirm,
  participantCount,
  loading,
}: CancelActivityModalProps) {
  const [reason, setReason] = useState("");

  const hasParticipants = participantCount > 0;

  function handleConfirm() {
    onConfirm(reason);
  }

  function handleClose() {
    if (!loading) {
      setReason("");
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Ställ in aktivitet"
    >
      <div className="space-y-4">
        {hasParticipants ? (
          <>
            <p className="text-sm text-secondary">
              Det finns{" "}
              <span className="font-semibold text-heading">
                {participantCount}
              </span>{" "}
              anmälda deltagare som kommer meddelas.
            </p>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="cancel-reason"
                className="text-sm font-medium text-heading"
              >
                Anledning (obligatorisk)
              </label>
              <textarea
                id="cancel-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Berätta varför aktiviteten ställs in..."
                className="w-full px-3 py-2 rounded-[8px] border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-secondary">
            Aktiviteten har inga deltagare och kommer raderas helt.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            onClick={handleConfirm}
            disabled={hasParticipants && reason.trim().length === 0}
          >
            {hasParticipants ? "Ställ in" : "Radera"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
