"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  loadSnapshot,
  clearSnapshot,
  type FeedbackSnapshot,
} from "@/lib/feedback-snapshot";
import {
  submitTip,
  uploadFeedbackScreenshot,
} from "@/actions/feedback-tips";

type Kind = "bug" | "idea";

const MIN_DESCRIPTION = 10;

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [header, base64] = dataUrl.split(",");
    if (!header || !base64) return null;
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const mime = mimeMatch?.[1] ?? "image/png";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function TipsaForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [kind, setKind] = useState<Kind | null>(null);
  const [description, setDescription] = useState("");
  const [snapshot, setSnapshot] = useState<FeedbackSnapshot | null>(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only, so we can't use a lazy initializer without hydration mismatch.
    setSnapshot(loadSnapshot());
  }, []);

  const descTooShort = description.trim().length < MIN_DESCRIPTION;
  const canSubmit = !!kind && !descTooShort && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !kind) return;
    setSubmitting(true);

    let screenshotImageId: string | undefined;
    if (includeScreenshot && snapshot?.screenshotDataUrl) {
      const blob = dataUrlToBlob(snapshot.screenshotDataUrl);
      if (blob) {
        const fd = new FormData();
        fd.set("file", new File([blob], "screenshot.png", { type: blob.type }));
        const upload = await uploadFeedbackScreenshot(fd);
        if (upload.success) {
          screenshotImageId = upload.imageId;
        } else {
          // Skärmdumpen är optional, fortsätt utan
          toast(upload.error ?? "Skärmdumpen kunde inte sparas", "warning");
        }
      }
    }

    const result = await submitTip({
      kind,
      description: description.trim(),
      pageUrl: snapshot?.pageUrl,
      userAgent: snapshot?.userAgent,
      viewportWidth: snapshot?.viewportWidth,
      viewportHeight: snapshot?.viewportHeight,
      consoleLog: snapshot?.consoleLog || undefined,
      appVersion: snapshot?.appVersion,
      screenshotImageId,
    });

    setSubmitting(false);

    if (result.success) {
      clearSnapshot();
      router.push("/tipsa/tack");
    } else {
      toast(result.error ?? "Något gick fel", "error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card title="Vad handlar det om?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <KindButton
            value="bug"
            current={kind}
            onSelect={setKind}
            emoji="🐞"
            label="Något funkar inte"
          />
          <KindButton
            value="idea"
            current={kind}
            onSelect={setKind}
            emoji="💡"
            label="En idé"
          />
        </div>
      </Card>

      <Card title="Berätta">
        <label htmlFor="tip-description" className="block text-sm font-medium text-heading mb-2">
          Vad hände? Vad försökte du göra?
        </label>
        <textarea
          id="tip-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          placeholder="Till exempel: Jag försökte gå med i vandringen på lördag, men knappen gjorde ingenting när jag tryckte."
          className="w-full rounded-control border border-border px-4 py-3 text-base text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
          required
          minLength={MIN_DESCRIPTION}
          maxLength={8000}
        />
        <p className="text-xs text-secondary mt-2">
          Skriv som du skulle berätta för en kompis. Vi fyller i det tekniska åt dig.
        </p>
      </Card>

      {snapshot?.screenshotDataUrl && (
        <Card title="Skärmdump">
          <div className="space-y-3">
            <img
              src={snapshot.screenshotDataUrl}
              alt="Skärmdump som följer med tipset"
              className={`w-full rounded-control border border-border ${includeScreenshot ? "" : "opacity-30"}`}
            />
            <label className="flex items-center gap-2 text-sm text-heading cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeScreenshot}
                onChange={(e) => setIncludeScreenshot(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>
                Skicka med skärmdumpen
                <span className="text-secondary text-xs ml-2">
                  (vi tog en automatiskt när du klickade)
                </span>
              </span>
            </label>
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between pt-2">
        <p className="text-xs text-secondary">
          Vi följer också med teknisk info i bakgrunden (vilken sida du var på,
          vilken enhet du använder) så vi snabbare kan hitta felet.
        </p>
        <Button type="submit" size="lg" loading={submitting} disabled={!canSubmit}>
          Skicka tipset
        </Button>
      </div>
    </form>
  );
}

interface KindButtonProps {
  value: Kind;
  current: Kind | null;
  onSelect: (k: Kind) => void;
  emoji: string;
  label: string;
}

function KindButton({ value, current, onSelect, emoji, label }: KindButtonProps) {
  const selected = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={`
        flex items-center gap-3 rounded-control border-2 px-4 py-4 text-left
        transition-colors min-h-touch-target
        ${selected
          ? "border-primary bg-primary-light text-heading"
          : "border-border bg-white text-heading hover:border-primary hover:bg-primary-light/50"}
      `}
    >
      <span className="text-2xl" aria-hidden="true">{emoji}</span>
      <span className="font-medium text-base">{label}</span>
    </button>
  );
}
