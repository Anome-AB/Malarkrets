"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { EmojiPicker } from "frimousse";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  id?: string;
}

// WYSIWYG-editor för aktivitetsbeskrivningar. Bold, Italic och Bullet List
// + native emoji-input. Outputtar HTML som sanitiseras vid rendering
// (sanitizeRichText). Användarens OS-emoji-väljare funkar direkt
// (Win+. på Windows, Ctrl+Cmd+Space på Mac, emoji-tangenten på mobil).
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  id,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Vi tillåter bara bold, italic, bullet list. Stänger av övriga
        // starter-kit-extensioner så toolbar och tillåtna utdata-taggar
        // matchar varandra.
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
        emptyEditorClass:
          "is-editor-empty before:content-[attr(data-placeholder)] before:text-dimmed before:float-left before:h-0 before:pointer-events-none",
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        id: id ?? "",
        class:
          "rich-text-prose min-h-[140px] px-4 py-3 outline-none focus:outline-none",
      },
      // Blockera bildklistring och bild-drag-drop. Windows emoji-panel
      // har en GIF-flik som annars infogar img-element. Vi tillåter
      // bara text, emojis och formaterad text (inte bilder).
      handlePaste(_view, event) {
        const dt = event.clipboardData;
        if (!dt) return false;
        // Stoppa direkt om paste innehåller fil(er) eller bild-MIME.
        if (dt.types.includes("Files")) return true;
        for (const item of Array.from(dt.items)) {
          if (item.type.startsWith("image/")) return true;
        }
        return false;
      },
      handleDrop(_view, event) {
        const dt = (event as DragEvent).dataTransfer;
        if (!dt) return false;
        if (dt.types.includes("Files")) {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
  });

  // Synka extern value-ändring (t.ex. react-hook-form reset). Skippa om
  // editorns nuvarande HTML redan matchar för att undvika loopar.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div className="rounded-control border border-border bg-white focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-shadow">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
}

function Toolbar({ editor }: ToolbarProps) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiWrapperRef = useRef<HTMLDivElement>(null);

  // Stäng emoji-popovern vid klick utanför eller Escape.
  useEffect(() => {
    if (!emojiOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (
        emojiWrapperRef.current &&
        !emojiWrapperRef.current.contains(e.target as Node)
      ) {
        setEmojiOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [emojiOpen]);

  function insertEmoji(emoji: string) {
    editor.chain().focus().insertContent(emoji).run();
    setEmojiOpen(false);
  }

  return (
    <div className="flex items-center gap-1 border-b border-border-light bg-background px-2 py-1.5">
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Fetstil (Ctrl+B)"
        ariaLabel="Fetstil"
      >
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Kursiv (Ctrl+I)"
        ariaLabel="Kursiv"
      >
        <span className="italic font-serif">I</span>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Punktlista"
        ariaLabel="Punktlista"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </ToolbarButton>
      <div className="relative" ref={emojiWrapperRef}>
        <ToolbarButton
          active={emojiOpen}
          onClick={() => setEmojiOpen((v) => !v)}
          title="Lägg till emoji"
          ariaLabel="Lägg till emoji"
        >
          <span aria-hidden="true">😊</span>
        </ToolbarButton>
        {emojiOpen && (
          <div className="absolute left-0 top-full mt-1 z-50 rounded-card border border-border bg-white shadow-xl overflow-hidden">
            <EmojiPicker.Root
              onEmojiSelect={({ emoji }) => insertEmoji(emoji)}
              className="frimousse-root h-[320px] w-[320px] flex flex-col bg-white"
              locale="sv"
            >
              <EmojiPicker.Search
                placeholder="Sök emoji…"
                className="m-2 px-3 py-2 text-sm bg-background rounded-control border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <EmojiPicker.Viewport className="relative flex-1 outline-none">
                <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-secondary">
                  Laddar…
                </EmojiPicker.Loading>
                <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-secondary">
                  Inga träffar
                </EmojiPicker.Empty>
                <EmojiPicker.List
                  className="select-none pb-2"
                  components={{
                    CategoryHeader: ({ category, ...props }) => (
                      <div
                        {...props}
                        className="bg-white px-2 pt-2 pb-1 text-xs font-semibold text-secondary uppercase tracking-wide"
                      >
                        {category.label}
                      </div>
                    ),
                    Row: ({ children, ...props }) => (
                      <div {...props} className="flex px-1">
                        {children}
                      </div>
                    ),
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        {...props}
                        className="flex items-center justify-center size-9 text-xl rounded-control hover:bg-primary-light data-[active]:bg-primary-light"
                      >
                        {emoji.emoji}
                      </button>
                    ),
                  }}
                />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          </div>
        )}
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  active: boolean;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
}

function ToolbarButton({
  active,
  onClick,
  title,
  ariaLabel,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`
        inline-flex items-center justify-center w-8 h-8 rounded-control text-sm
        transition-colors
        ${active
          ? "bg-primary text-white"
          : "text-heading hover:bg-primary-light"}
      `}
    >
      {children}
    </button>
  );
}
