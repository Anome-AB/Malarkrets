"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { anonymizeUser, deleteTag, addTags } from "@/actions/admin";

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  createdAt: string | null;
}

interface TagRow {
  id: number;
  name: string;
  slug: string;
  category: string | null;
}

interface AdminClientProps {
  users: UserRow[];
  tags: TagRow[];
}

export function AdminClient({ users, tags }: AdminClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [newTags, setNewTags] = useState("");

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmVariant, setConfirmVariant] = useState<"danger" | "primary">("danger");
  const [confirmLabel, setConfirmLabel] = useState("Bekräfta");

  function showConfirm(opts: {
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "primary";
    confirmLabel?: string;
  }) {
    setConfirmTitle(opts.title);
    setConfirmMessage(opts.message);
    setConfirmAction(() => opts.onConfirm);
    setConfirmVariant(opts.variant ?? "danger");
    setConfirmLabel(opts.confirmLabel ?? "Bekräfta");
    setConfirmOpen(true);
  }

  function handleAnonymize(userId: string, email: string) {
    showConfirm({
      title: "Anonymisera användare",
      message: `Vill du anonymisera användaren ${email}? Användarens personliga data raderas permanent. Detta kan inte ångras.`,
      confirmLabel: "Anonymisera",
      onConfirm: () => {
        setConfirmOpen(false);
        startTransition(async () => {
          const result = await anonymizeUser(userId);
          if (result.success) {
            toast("Användaren har anonymiserats", "success");
            router.refresh();
          } else {
            toast(result.error ?? "Något gick fel", "error");
          }
        });
      },
    });
  }

  function handleDeleteTag(tagId: number, tagName: string) {
    showConfirm({
      title: "Ta bort tagg",
      message: `Vill du ta bort taggen "${tagName}"? Den tas bort från alla användare och aktiviteter.`,
      confirmLabel: "Ta bort",
      onConfirm: () => {
        setConfirmOpen(false);
        startTransition(async () => {
          const result = await deleteTag(tagId);
          if (result.success) {
            toast(`Taggen "${tagName}" har tagits bort`, "success");
            router.refresh();
          } else {
            toast(result.error ?? "Något gick fel", "error");
          }
        });
      },
    });
  }

  function handleAddTags() {
    const names = newTags
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length === 0) {
      toast("Skriv minst en tagg", "error");
      return;
    }

    startTransition(async () => {
      const result = await addTags(names);
      if (result.success) {
        toast(`${result.count} tagg(ar) har lagts till`, "success");
        setNewTags("");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  return (
    <>
      <ConfirmDialog
        open={confirmOpen}
        onConfirm={confirmAction}
        onCancel={() => setConfirmOpen(false)}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        variant={confirmVariant}
        loading={isPending}
      />

      <div className="space-y-10">
        {/* Users section */}
        <section>
          <h2 className="text-lg font-semibold text-[#2d2d2d] mb-4">
            Användare ({users.length})
          </h2>
          <div className="bg-white border border-[#dddddd] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f8f7f4] border-b border-[#dddddd]">
                    <th className="text-left px-4 py-3 font-medium text-[#666666]">E-post</th>
                    <th className="text-left px-4 py-3 font-medium text-[#666666]">Namn</th>
                    <th className="text-left px-4 py-3 font-medium text-[#666666]">Skapad</th>
                    <th className="text-left px-4 py-3 font-medium text-[#666666]">Roll</th>
                    <th className="text-right px-4 py-3 font-medium text-[#666666]">Åtgärd</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[#eeeeee] last:border-b-0">
                      <td className="px-4 py-3 text-[#2d2d2d]">{user.email}</td>
                      <td className="px-4 py-3 text-[#2d2d2d]">
                        {user.displayName ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString("sv-SE")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {user.isAdmin ? (
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e8f0ec] text-[#3d6b5e]">
                            Admin
                          </span>
                        ) : (
                          <span className="text-[#666666]">Användare</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleAnonymize(user.id, user.email)}
                          disabled={isPending}
                          className="text-xs text-[#dc3545] hover:underline disabled:opacity-50"
                        >
                          Anonymisera
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Interest tags section */}
        <section>
          <h2 className="text-lg font-semibold text-[#2d2d2d] mb-4">
            Intressetaggar ({tags.length})
          </h2>

          {/* Add tags form */}
          <div className="bg-white border border-[#dddddd] rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-[#2d2d2d] mb-2">
              Lägg till taggar
            </h3>
            <textarea
              rows={3}
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              placeholder={"En tagg per rad, t.ex.\nPaddel\nTennis\nGolf"}
              className="w-full px-3 py-2 rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y text-sm mb-2"
            />
            <Button
              variant="primary"
              size="sm"
              loading={isPending}
              onClick={handleAddTags}
            >
              Lägg till
            </Button>
          </div>

          {/* Tag list */}
          <div className="bg-white border border-[#dddddd] rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#e8f0ec] text-[#3d6b5e]"
                >
                  <span>{tag.name}</span>
                  {tag.category && (
                    <span className="text-[#999999]">({tag.category})</span>
                  )}
                  <button
                    onClick={() => handleDeleteTag(tag.id, tag.name)}
                    disabled={isPending}
                    className="ml-1 text-[#dc3545] hover:text-[#a71d2a] disabled:opacity-50 leading-none"
                    title="Ta bort"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
