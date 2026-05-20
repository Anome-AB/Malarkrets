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

type Kind = "bug" | "idea" | "interest";

const MIN_DESCRIPTION = 10;
const MAX_INTEREST_NAMES = 10;
const MIN_INTEREST_NAME = 2;

const TEXT_KIND_COPY: Record<
  "bug" | "idea",
  { label: string; placeholder: string; help: string }
> = {
  bug: {
    label: "Vad hände? Vad försökte du göra?",
    placeholder:
      "Till exempel: Jag försökte gå med i vandringen på lördag, men knappen gjorde ingenting när jag klickade på den.",
    help: "Skriv som du skulle berätta för en kompis. Vi fyller i det tekniska åt dig.",
  },
  idea: {
    label: "Vad har du för förslag?",
    placeholder:
      "Till exempel: Det vore kul att se aktiviteter på en kalender, så jag kan planera in flera samma vecka.",
    help: "Berätta så konkret du kan vad du saknar eller vill se. Vi tar med oss alla förslag i planeringen.",
  },
};

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
  const [kind, setKind] = useState<Kind>("bug");
  const [description, setDescription] = useState("");
  const [interestNames, setInterestNames] = useState<string[]>([""]);
  const [snapshot, setSnapshot] = useState<FeedbackSnapshot | null>(null);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only, so we can't use a lazy initializer without hydration mismatch.
    setSnapshot(loadSnapshot());
  }, []);

  const validNames = interestNames
    .map((n) => n.trim())
    .filter((n) => n.length >= MIN_INTEREST_NAME);

  const descTooShort = description.trim().length < MIN_DESCRIPTION;
  const interestInvalid = kind === "interest" && validNames.length === 0;
  const textInvalid = kind !== "interest" && descTooShort;
  const canSubmit = !textInvalid && !interestInvalid && !submitting;

  function updateName(i: number, value: string) {
    setInterestNames((prev) => prev.map((n, idx) => (idx === i ? value : n)));
  }

  function addNameRow() {
    if (interestNames.length >= MAX_INTEREST_NAMES) return;
    setInterestNames((prev) => [...prev, ""]);
  }

  function removeNameRow(i: number) {
    setInterestNames((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);

    let screenshotImageId: string | undefined;
    if (kind !== "interest" && includeScreenshot && snapshot?.screenshotDataUrl) {
      const blob = dataUrlToBlob(snapshot.screenshotDataUrl);
      if (blob) {
        const fd = new FormData();
        fd.set("file", new File([blob], "screenshot.png", { type: blob.type }));
        const upload = await uploadFeedbackScreenshot(fd);
        if (upload.success) {
          screenshotImageId = upload.imageId;
        } else {
          toast(upload.error ?? "Skärmdumpen kunde inte sparas", "warning");
        }
      }
    }

    const result = await submitTip({
      kind,
      description: kind === "interest" ? description.trim() : description.trim(),
      interestNames: kind === "interest" ? validNames : undefined,
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KindButton
            value="bug"
            current={kind}
            onSelect={setKind}
            emoji="🐞"
            label="Något fungerar inte"
          />
          <KindButton
            value="idea"
            current={kind}
            onSelect={setKind}
            emoji="💡"
            label="Ett förslag"
          />
          <KindButton
            value="interest"
            current={kind}
            onSelect={setKind}
            emoji="🏷️"
            label="Föreslå intresse"
          />
        </div>
      </Card>

      {kind === "interest" ? (
        <>
          <Card title="Vilka intressen saknar du?">
            <ul className="space-y-2">
              {interestNames.map((name, i) => (
                <li key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => updateName(i, e.target.value)}
                    placeholder="T.ex. Motorsport, Dans, Musik"
                    maxLength={60}
                    className="flex-1 rounded-control border border-border px-4 py-2.5 text-base text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeNameRow(i)}
                    disabled={interestNames.length === 1}
                    aria-label="Ta bort raden"
                    className="px-3 rounded-control border border-border text-secondary hover:text-error hover:border-error disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            {interestNames.length < MAX_INTEREST_NAMES && (
              <button
                type="button"
                onClick={addNameRow}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Lägg till ett till
              </button>
            )}
            <p className="text-xs text-secondary mt-3">
              Håll förslagen ganska generella (t.ex. Motorsport, Dans, Musik)
              så att fler aktiviteter passar in. Admin tittar igenom och
              godkänner ett i taget.
            </p>
          </Card>

          <Card title="Berätta gärna mer (frivilligt)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Varför skulle det vara bra att ha? Vilka aktiviteter passar?"
              className="w-full rounded-control border border-border px-4 py-3 text-base text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              maxLength={8000}
            />
          </Card>
        </>
      ) : (
        <Card title="Berätta">
          <label
            htmlFor="tip-description"
            className="block text-sm font-medium text-heading mb-2"
          >
            {TEXT_KIND_COPY[kind].label}
          </label>
          <textarea
            id="tip-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder={TEXT_KIND_COPY[kind].placeholder}
            className="w-full rounded-control border border-border px-4 py-3 text-base text-heading bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            required
            minLength={MIN_DESCRIPTION}
            maxLength={8000}
          />
          <p className="text-xs text-secondary mt-2">
            {TEXT_KIND_COPY[kind].help}
          </p>
        </Card>
      )}

      {kind !== "interest" && snapshot?.screenshotDataUrl && (
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
          {kind === "interest"
            ? "Vi loggar inte skärmdumpar eller teknisk info för intresseförslag."
            : "Vi följer också med teknisk info i bakgrunden (vilken sida du var på, vilken enhet du använder) så vi snabbare kan hitta felet."}
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
  current: Kind;
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
