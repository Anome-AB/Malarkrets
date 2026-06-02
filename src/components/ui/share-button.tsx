"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

interface ShareButtonProps {
  /** Absolut eller relativ URL att dela. Relativa URL:er löses mot window.location.origin. */
  url: string;
  /** Titel som visas i ämnesraden vid e-postdelning. */
  title?: string;
  /** Beskrivande text som följer med på de plattformar som stödjer det. */
  text?: string;
  /** Ren ikon utan text. Kräver att aria-label sätts via parent eller standardvärdet "Dela". */
  iconOnly?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

type ShareCtx = {
  url: string;
  title: string;
  text: string;
  toast: (msg: string, type?: "success" | "error" | "info") => void;
};

type ShareTarget = {
  key: string;
  label: string;
  /** Tailwind bg-* eller arbitrary värde, t.ex. bg-[#25D366]. */
  bgClass: string;
  /** Färg på texten ovanpå bg, t.ex. text-white. */
  fgClass: string;
  icon: ReactNode;
  share: (ctx: ShareCtx) => void | Promise<void>;
};

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Brand-ikoner som inline-SVG. Behåller path-data minimalt för att inte spränga
// bundlen - vi använder monokroma former ovanpå brand-färgad bakgrund.
const Icons = {
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  ),
  messenger: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6">
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0Zm1.191 14.963-3.055-3.26-5.963 3.26L10.733 8l3.131 3.26L19.752 8l-6.561 6.963Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.022 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.014 1.792-4.679 4.533-4.679 1.313 0 2.686.235 2.686.235v2.965h-1.513c-1.491 0-1.956.93-1.956 1.886v2.255h3.328l-.532 3.491h-2.796v8.437C19.612 23.095 24 18.1 24 12.073Z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0Zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.231-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  ),
  snapchat: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6">
      <path d="M12.166.39a5.847 5.847 0 0 1 5.182 3.092c.34.654.42 1.453.477 2.18.054.69.027 1.387-.014 2.077-.005.088.024.123.105.137.232.04.575.04.749-.137.108-.108.156-.235.359-.235.205 0 .455.083.622.193.215.142.317.327.317.488 0 .242-.222.394-.483.522-.171.083-.42.118-.581.197-.124.064-.224.155-.234.293-.025.342 1.094 2.27 2.92 2.566.227.038.336.218.302.405-.07.388-1.198.916-2.604 1.144-.072.097-.144.51-.244.836-.04.131-.122.197-.27.197h-.013c-.184-.005-.378-.057-.679-.057-.41 0-.79.067-1.226.157-.736.151-1.301.728-1.95 1.21-.886.66-1.793 1.334-3.13 1.334-.057 0-.114-.002-.171-.005-.066.003-.131.005-.197.005-1.337 0-2.244-.674-3.13-1.333-.65-.483-1.214-1.06-1.95-1.211a6.013 6.013 0 0 0-1.226-.157c-.301 0-.495.052-.679.057-.149 0-.23-.066-.27-.197-.1-.326-.172-.74-.244-.836-1.406-.228-2.534-.756-2.604-1.144-.034-.187.075-.367.302-.405 1.826-.296 2.945-2.224 2.92-2.566-.01-.138-.11-.229-.234-.293-.16-.079-.41-.114-.581-.197-.26-.128-.483-.28-.483-.522 0-.16.102-.346.317-.488.168-.11.418-.193.622-.193.203 0 .25.127.359.235.174.177.517.176.749.137.081-.014.11-.05.105-.137-.041-.69-.068-1.388-.014-2.077.057-.727.137-1.526.477-2.18A5.847 5.847 0 0 1 12.166.39Z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-6 h-6">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.71a8.17 8.17 0 0 0 4.77 1.52V6.79a4.83 4.83 0 0 1-1.84-.1Z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-6 h-6">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-6 h-6">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
};

// Plattformar som inte har ett fungerande web-share-intent (Snapchat, TikTok)
// och inte heller en stabil unauthenticated share-URL (Messenger utan FB
// app_id) får "kopiera+öppna app/sajt"-flödet med en förklarande toast.
function copyAndOpen(targetUrl: string, ctx: ShareCtx, appName: string) {
  return copyToClipboard(ctx.url).then((ok) => {
    if (ok) {
      ctx.toast(`Länken kopierad - klistra in i ${appName}`, "success");
    } else {
      ctx.toast(`Kunde inte kopiera länken automatiskt`, "error");
    }
    openInNewTab(targetUrl);
  });
}

const TARGETS: ShareTarget[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    bgClass: "bg-[#25D366]",
    fgClass: "text-white",
    icon: Icons.whatsapp,
    share: ({ url, text }) => {
      const msg = encodeURIComponent(text ? `${text}\n${url}` : url);
      openInNewTab(`https://wa.me/?text=${msg}`);
    },
  },
  {
    key: "messenger",
    label: "Messenger",
    bgClass: "bg-[#0084FF]",
    fgClass: "text-white",
    icon: Icons.messenger,
    // Messenger har ingen unauthenticated share-URL utan FB app_id, så vi
    // kopierar länken och försöker ett deep-link som funkar om appen finns.
    share: (ctx) =>
      copyAndOpen(
        `fb-messenger://share?link=${encodeURIComponent(ctx.url)}`,
        ctx,
        "Messenger",
      ),
  },
  {
    key: "facebook",
    label: "Facebook",
    bgClass: "bg-[#1877F2]",
    fgClass: "text-white",
    icon: Icons.facebook,
    share: ({ url }) => {
      openInNewTab(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      );
    },
  },
  {
    key: "telegram",
    label: "Telegram",
    bgClass: "bg-[#26A5E4]",
    fgClass: "text-white",
    icon: Icons.telegram,
    share: ({ url, text }) => {
      const params = new URLSearchParams({ url });
      if (text) params.set("text", text);
      openInNewTab(`https://t.me/share/url?${params.toString()}`);
    },
  },
  {
    key: "snapchat",
    label: "Snapchat",
    bgClass: "bg-[#FFFC00]",
    fgClass: "text-black",
    icon: Icons.snapchat,
    // Snapchat saknar publik web-share-intent. Kopiera + öppna appen om den
    // finns på enheten, annars snapchat.com på desktop.
    share: (ctx) => copyAndOpen("https://www.snapchat.com/", ctx, "Snapchat"),
  },
  {
    key: "tiktok",
    label: "TikTok",
    bgClass: "bg-black",
    fgClass: "text-white",
    icon: Icons.tiktok,
    // TikTok har ingen publik web-share-intent heller. Samma flöde som Snapchat.
    share: (ctx) => copyAndOpen("https://www.tiktok.com/", ctx, "TikTok"),
  },
  {
    key: "email",
    label: "E-post",
    bgClass: "bg-secondary",
    fgClass: "text-white",
    icon: Icons.email,
    share: ({ url, title, text }) => {
      const subject = encodeURIComponent(title || "Tips från Vänliga Västerås");
      const body = encodeURIComponent(`${text ? `${text}\n\n` : ""}${url}`);
      // location.href istället för window.open: mailto öppnas av OS-handler
      // och fungerar inte bra i ny tab på alla browsers.
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    },
  },
  {
    key: "copy",
    label: "Kopiera länk",
    bgClass: "bg-muted",
    fgClass: "text-heading",
    icon: Icons.link,
    share: async (ctx) => {
      const ok = await copyToClipboard(ctx.url);
      ctx.toast(
        ok ? "Länken kopierad" : "Kunde inte kopiera länken",
        ok ? "success" : "error",
      );
    },
  },
];

/**
 * Dela-knapp som öppnar en dialog med kurerade delningsalternativ. Vi använder
 * inte Web Share API här - en del native share-targets (t.ex. Teams) öppnar
 * appen utan att faktiskt skicka URL:en, så vi exponerar bara plattformar där
 * vi vet att flödet fungerar.
 *
 * Open Graph-metadata på destinationssidan styr vilken bild/titel som syns
 * när URL:en klistras in i sociala medier.
 */
export function ShareButton({
  url,
  title,
  text,
  iconOnly = false,
  variant = "secondary",
  size = "compact",
  className = "",
}: ShareButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  function resolveUrl(): string {
    if (typeof window === "undefined") return url;
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  async function handleTarget(target: ShareTarget) {
    const ctx: ShareCtx = {
      url: resolveUrl(),
      title: title ?? "",
      text: text ?? "",
      toast,
    };
    try {
      await target.share(ctx);
    } catch {
      toast("Något gick fel vid delning", "error");
    } finally {
      setOpen(false);
    }
  }

  const shareIcon = (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );

  const triggerButton = iconOnly ? (
    <Button
      variant={variant}
      size={size}
      onClick={() => setOpen(true)}
      aria-label="Dela"
      className={className}
      type="button"
    >
      {shareIcon}
    </Button>
  ) : (
    <Button
      variant={variant}
      size={size}
      onClick={() => setOpen(true)}
      className={className}
      type="button"
    >
      <span className="mr-2 inline-flex">{shareIcon}</span>
      Dela
    </Button>
  );

  return (
    <>
      {triggerButton}
      <Modal open={open} onClose={() => setOpen(false)} title="Dela aktivitet" size="md">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-2">
          {TARGETS.map((target) => (
            <button
              key={target.key}
              type="button"
              onClick={() => handleTarget(target)}
              className="flex flex-col items-center gap-2 p-3 rounded-control hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            >
              <span
                className={`w-12 h-12 rounded-full flex items-center justify-center ${target.bgClass} ${target.fgClass}`}
              >
                {target.icon}
              </span>
              <span className="text-xs text-heading text-center leading-tight">
                {target.label}
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
