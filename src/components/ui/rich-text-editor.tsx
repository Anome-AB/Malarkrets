"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

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
    <div className="rounded-control border border-border bg-white focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-shadow overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolbarProps {
  editor: Editor;
}

function Toolbar({ editor }: ToolbarProps) {
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
      <span className="ml-2 text-xs text-secondary select-none" aria-hidden="true">
        😊 via emoji-tangenten (Win+. / Cmd+Ctrl+Space)
      </span>
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
