"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { uploadActivityImage } from "@/actions/upload";
import { useToast } from "@/components/ui/toast";
import { ImageCropModal } from "@/components/ui/image-crop-modal";
import { ColorPicker } from "@/components/ui/color-picker";

interface ImageUploadProps {
  thumbUrl: string | null;
  mediumUrl: string | null;
  ogUrl: string | null;
  colorTheme: string | null;
  onChange: (images: {
    thumbUrl: string | null;
    mediumUrl: string | null;
    ogUrl: string | null;
  }) => void;
  onColorChange: (colorTheme: string | null) => void;
}

export function ImageUpload({ thumbUrl, mediumUrl, ogUrl, colorTheme, onChange, onColorChange }: ImageUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const hasImage = !!(thumbUrl || mediumUrl || ogUrl);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const uploadBlob = useCallback(
    async (blob: Blob, filename: string): Promise<boolean> => {
      setUploading(true);
      const file = new File([blob], filename, { type: blob.type });
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadActivityImage(formData);
      setUploading(false);

      if (result.success) {
        onChange({
          thumbUrl: result.thumbUrl,
          mediumUrl: result.mediumUrl,
          ogUrl: result.ogUrl,
        });
        toast("Bilden har laddats upp", "success");
        return true;
      } else {
        toast(result.error, "error");
        return false;
      }
    },
    [onChange, toast],
  );

  function handleFileSelect(file: File) {
    // Show crop modal with the selected image
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
    const success = await uploadBlob(blob, "activity-image.jpg");
    if (success) {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function handleRemove() {
    onChange({ thumbUrl: null, mediumUrl: null, ogUrl: null });
  }

  function handleChangeImage() {
    inputRef.current?.click();
  }

  return (
    <>
      {hasImage ? (
        <div className="relative">
          <img
            src={mediumUrl ?? thumbUrl ?? ""}
            alt="Aktivitetsbild"
            className="w-full aspect-video object-cover rounded-[8px] border border-border"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={handleChangeImage}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 text-heading text-xs font-medium shadow-md hover:bg-white transition-colors"
            >
              Byt bild
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/90 text-error text-xs font-medium shadow-md hover:bg-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Ta bort
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            w-full aspect-video rounded-[8px] border-2 border-dashed cursor-pointer
            flex flex-col items-center justify-center gap-2 transition-colors
            ${dragActive ? "border-primary bg-primary-light" : "border-border bg-background hover:border-primary hover:bg-primary-light/50"}
            ${uploading ? "opacity-50 cursor-wait" : ""}
          `}
        >
          {uploading ? (
            <>
              <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-secondary">Laddar upp...</p>
            </>
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-dimmed">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p className="text-sm font-medium text-heading">
                Dra & släpp bild här eller klicka
              </p>
              <p className="text-xs text-dimmed">
                JPG, PNG eller WebP. Max 10 MB.
              </p>
            </>
          )}
        </div>
      )}

      {/* Color picker — only when no image */}
      {!hasImage && (
        <div className="mt-4">
          <ColorPicker value={colorTheme} onChange={onColorChange} />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        disabled={uploading}
      />

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
          loading={uploading}
        />
      )}
    </>
  );
}
