"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { useToast } from "@/components/ui/toast";
import {
  uploadProfileAvatar,
  setPresetAvatar,
  removeAvatar,
} from "@/actions/avatar";
import { AVATAR_PRESETS, presetUrl } from "@/lib/avatar-presets";

interface AvatarPickerProps {
  initialAvatarUrl: string | null;
  initials: string;
}

type DialogView = "upload" | "library";

export function AvatarPicker({
  initialAvatarUrl,
  initials,
}: AvatarPickerProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<DialogView>("upload");
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  function openDialog() {
    setView("upload");
    setDialogOpen(true);
  }

  function handleFileSelect(file: File) {
    const src = URL.createObjectURL(file);
    setCropSrc(src);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function handleCropConfirm(blob: Blob) {
    setBusy(true);
    const formData = new FormData();
    formData.set("file", new File([blob], "avatar.jpg", { type: blob.type }));
    const result = await uploadProfileAvatar(formData);
    setBusy(false);
    if (result.success) {
      setAvatarUrl(result.url);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setDialogOpen(false);
      toast("Profilbilden har uppdaterats", "success");
    } else {
      toast(result.error, "error");
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function handlePresetClick(filename: string) {
    if (busy) return;
    setBusy(true);
    startTransition(async () => {
      const result = await setPresetAvatar(filename);
      setBusy(false);
      if (result.success) {
        setAvatarUrl(result.url);
        setDialogOpen(false);
        toast("Profilbilden har uppdaterats", "success");
      } else {
        toast(result.error, "error");
      }
    });
  }

  function handleRemove() {
    setBusy(true);
    startTransition(async () => {
      const result = await removeAvatar();
      setBusy(false);
      if (result.success) {
        setAvatarUrl(null);
        toast("Profilbilden borttagen", "success");
      } else {
        toast(result.error, "error");
      }
    });
  }

  const dialogTitle =
    view === "upload" ? "Ändra profilbild" : "Välj från bibliotek";

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <button
          type="button"
          onClick={openDialog}
          aria-label="Ändra profilbild"
          className="w-32 h-32 rounded-full overflow-hidden border-2 border-border bg-background flex items-center justify-center shrink-0 transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Din profilbild"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-3xl font-semibold text-secondary select-none">
              {initials}
            </span>
          )}
        </button>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm text-heading font-medium mb-1">Din profilbild</p>
          <p className="text-xs text-dimmed mb-4">
            Visas i toppmenyn och bredvid dina aktiviteter.
          </p>
          <div className="flex flex-wrap items-center gap-4 justify-center sm:justify-start">
            <Button onClick={openDialog}>Ändra profilbild</Button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="text-sm text-error hover:underline disabled:opacity-50"
              >
                Ta bort
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={dialogTitle}
        size="lg"
      >
        {view === "upload" && (
          <div className="space-y-4">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !busy && inputRef.current?.click()}
              className={`w-full max-w-sm aspect-square mx-auto rounded-control border-2 border-dashed cursor-pointer
                flex flex-col items-center justify-center gap-3 px-6 transition-colors
                ${
                  dragActive
                    ? "border-primary bg-primary-light"
                    : "border-border bg-background hover:border-primary hover:bg-primary-light/50"
                }
                ${busy ? "opacity-50 cursor-wait" : ""}`}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-dimmed"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-base font-medium text-heading text-center">
                Dra & släpp eller klicka för att välja
              </p>
              <p className="text-xs text-dimmed text-center">
                JPG, PNG eller WebP. Max 10 MB.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-dimmed font-medium uppercase tracking-wide">
                eller
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="secondary"
              onClick={() => setView("library")}
              className="w-full"
            >
              Välj från vårt bibliotek
            </Button>
          </div>
        )}

        {view === "library" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setView("upload")}
              className="text-sm text-secondary hover:text-heading transition-colors"
            >
              Ladda upp egen istället
            </button>

            <div
              className="grid gap-2"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
              }}
            >
              {AVATAR_PRESETS.map((filename, i) => {
                const url = presetUrl(filename);
                const isSelected = avatarUrl === url;
                return (
                  <button
                    key={filename}
                    type="button"
                    onClick={() => handlePresetClick(filename)}
                    disabled={busy}
                    aria-label={`Profilbild nr ${i + 1}`}
                    aria-pressed={isSelected}
                    className={`aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105 ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    } disabled:opacity-60 disabled:cursor-wait disabled:hover:scale-100`}
                  >
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={busy}
      />

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          aspectRatio={1}
          cropShape="round"
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          loading={busy}
        />
      )}
    </>
  );
}
