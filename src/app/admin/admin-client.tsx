"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import {
  anonymizeUser,
  deleteTag,
  addTag,
  banUser,
  unbanUser,
  searchUsers,
} from "@/actions/admin";

// ─── Types ─────────────────────────────────────────────────────────────────

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string | null;
}

interface UsersResult {
  users: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface TagRow {
  id: number;
  name: string;
  slug: string;
}

interface AdminClientProps {
  initialUsers: UsersResult;
  tags: TagRow[];
}

// ─── Component ─────────────────────────────────────────────────────────────

export function AdminClient({ initialUsers, tags }: AdminClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"users" | "tags">("users");

  // ─── User state ────────────────────────────────────────────────────────
  const [usersData, setUsersData] = useState<UsersResult>(initialUsers);
  const [userSearch, setUserSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const loadUsers = useCallback(async (query: string, page: number) => {
    setSearchLoading(true);
    const result = await searchUsers(query, page);
    setUsersData(result);
    setSearchLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(userSearch, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, loadUsers]);

  function goToPage(page: number) {
    loadUsers(userSearch, page);
  }

  // ─── Tag state ─────────────────────────────────────────────────────────
  const [addingTag, setAddingTag] = useState(false);
  const [inlineTagName, setInlineTagName] = useState("");

  // ─── Confirm dialog ────────────────────────────────────────────────────
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

  // ─── Ban dialog ────────────────────────────────────────────────────────
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ id: string; email: string } | null>(null);
  const [banReasonType, setBanReasonType] = useState("inappropriate");
  const [banCustomReason, setBanCustomReason] = useState("");

  const presetReasons: Record<string, string> = {
    inappropriate: "Olämpligt beteende",
    spam: "Spam eller bedrägeri",
    tos: "Brott mot användarvillkor",
    custom: "",
  };

  // ─── User handlers ─────────────────────────────────────────────────────

  function handleBanClick(userId: string, email: string) {
    setBanTarget({ id: userId, email });
    setBanReasonType("inappropriate");
    setBanCustomReason("");
    setBanDialogOpen(true);
  }

  function handleBanConfirm() {
    if (!banTarget) return;
    const reason = banReasonType === "custom" ? banCustomReason.trim() : presetReasons[banReasonType];
    if (!reason) {
      toast("Ange en anledning", "error");
      return;
    }
    setBanDialogOpen(false);
    startTransition(async () => {
      const result = await banUser(banTarget.id, reason);
      if (result.success) {
        toast("Användaren har blockerats", "success");
        loadUsers(userSearch, usersData.page);
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function handleUnban(userId: string, email: string) {
    showConfirm({
      title: "Avblockera användare",
      message: `Vill du avblockera ${email}?`,
      confirmLabel: "Avblockera",
      variant: "primary",
      onConfirm: () => {
        setConfirmOpen(false);
        startTransition(async () => {
          const result = await unbanUser(userId);
          if (result.success) {
            toast("Användaren har avblockerats", "success");
            loadUsers(userSearch, usersData.page);
          } else {
            toast(result.error ?? "Något gick fel", "error");
          }
        });
      },
    });
  }

  function handleAnonymize(userId: string, email: string) {
    showConfirm({
      title: "Anonymisera användare",
      message: `Vill du anonymisera ${email}? All personlig data raderas permanent.`,
      confirmLabel: "Anonymisera",
      onConfirm: () => {
        setConfirmOpen(false);
        startTransition(async () => {
          const result = await anonymizeUser(userId);
          if (result.success) {
            toast("Användaren har anonymiserats", "success");
            loadUsers(userSearch, usersData.page);
          } else {
            toast(result.error ?? "Något gick fel", "error");
          }
        });
      },
    });
  }

  // ─── Tag handlers ──────────────────────────────────────────────────────

  function handleDeleteTag(tagId: number, tagName: string) {
    showConfirm({
      title: "Ta bort tagg",
      message: `Vill du ta bort "${tagName}"? Den tas bort från alla användare och aktiviteter.`,
      confirmLabel: "Ta bort",
      onConfirm: () => {
        setConfirmOpen(false);
        startTransition(async () => {
          const result = await deleteTag(tagId);
          if (result.success) {
            toast(`"${tagName}" borttagen`, "success");
            router.refresh();
          } else {
            toast(result.error ?? "Något gick fel", "error");
          }
        });
      },
    });
  }

  function handleInlineAddTag() {
    const name = inlineTagName.trim();
    if (!name) {
      setAddingTag(false);
      return;
    }
    startTransition(async () => {
      const result = await addTag(name);
      if (result.success) {
        toast(`"${name}" tillagd`, "success");
        setInlineTagName("");
        setAddingTag(false);
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const tabs = [
    { id: "users" as const, label: "Användare", count: usersData.total },
    { id: "tags" as const, label: "Intressetaggar", count: tags.length },
  ];

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

      <Modal
        open={banDialogOpen}
        onClose={() => setBanDialogOpen(false)}
        title="Blockera användare"
      >
        <p className="text-sm text-secondary mb-4">
          Blockera <strong>{banTarget?.email}</strong>? Användaren kommer inte kunna logga in och alla framtida aktiviteter ställs in.
        </p>
        <fieldset className="space-y-2 mb-4">
          <legend className="text-sm font-medium text-heading mb-2">Anledning</legend>
          {Object.entries(presetReasons).filter(([k]) => k !== "custom").map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="banReason" value={key} checked={banReasonType === key} onChange={() => setBanReasonType(key)} className="accent-primary" />
              <span className="text-sm text-heading">{label}</span>
            </label>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="banReason" value="custom" checked={banReasonType === "custom"} onChange={() => setBanReasonType("custom")} className="accent-primary" />
            <span className="text-sm text-heading">Annat</span>
          </label>
          {banReasonType === "custom" && (
            <textarea rows={2} value={banCustomReason} onChange={(e) => setBanCustomReason(e.target.value)} placeholder="Ange anledning..." className="w-full mt-1 px-3 py-2 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y text-sm" />
          )}
        </fieldset>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setBanDialogOpen(false)} disabled={isPending}>Avbryt</Button>
          <Button variant="danger" size="sm" onClick={handleBanConfirm} loading={isPending}>Blockera</Button>
        </div>
      </Modal>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-heading"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-dimmed">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === "users" && (
        <Card>
          {/* Search */}
          <div className="mb-4">
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Sök på e-post eller namn..."
              className="w-full max-w-md px-3 py-2 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary text-sm"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background border-y border-border">
                  <th className="text-left px-4 py-3 font-medium text-secondary">E-post</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary">Namn</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary">Skapad</th>
                  <th className="text-left px-4 py-3 font-medium text-secondary">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-secondary">Åtgärder</th>
                </tr>
              </thead>
              <tbody>
                {searchLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-dimmed">Söker...</td>
                  </tr>
                ) : usersData.users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-dimmed">
                      {userSearch ? `Inga användare matchar "${userSearch}"` : "Inga användare"}
                    </td>
                  </tr>
                ) : (
                  usersData.users.map((user) => (
                    <tr key={user.id} className={`border-b border-border-light last:border-b-0 ${user.isBanned ? "bg-red-50/50" : ""}`}>
                      <td className="px-4 py-3 text-heading">{user.email}</td>
                      <td className="px-4 py-3 text-heading">{user.displayName ?? "-"}</td>
                      <td className="px-4 py-3 text-secondary">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString("sv-SE") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {user.isAdmin ? (
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-light text-primary">Admin</span>
                        ) : user.isBanned ? (
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-error" title={user.banReason ?? undefined}>Blockerad</span>
                        ) : (
                          <span className="text-secondary">Aktiv</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!user.isAdmin && (
                          <div className="flex gap-2 justify-end">
                            {user.isBanned ? (
                              <Button variant="secondary" size="sm" onClick={() => handleUnban(user.id, user.email)} disabled={isPending}>
                                Avblockera
                              </Button>
                            ) : (
                              <Button variant="secondary" size="sm" onClick={() => handleBanClick(user.id, user.email)} disabled={isPending} className="!border-warning !text-warning hover:!bg-orange-50">
                                Blockera
                              </Button>
                            )}
                            <Button variant="secondary" size="sm" onClick={() => handleAnonymize(user.id, user.email)} disabled={isPending} className="!border-error !text-error hover:!bg-red-50">
                              Anonymisera
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {usersData.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background">
                <p className="text-xs text-secondary">
                  Visar {(usersData.page - 1) * usersData.pageSize + 1}–{Math.min(usersData.page * usersData.pageSize, usersData.total)} av {usersData.total}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => goToPage(usersData.page - 1)}
                    disabled={usersData.page <= 1 || searchLoading}
                    className="px-3 py-1.5 text-xs rounded-control border border-border text-secondary hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Föregående
                  </button>
                  {Array.from({ length: Math.min(usersData.totalPages, 5) }, (_, i) => {
                    // Show pages around current page
                    let pageNum: number;
                    if (usersData.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (usersData.page <= 3) {
                      pageNum = i + 1;
                    } else if (usersData.page >= usersData.totalPages - 2) {
                      pageNum = usersData.totalPages - 4 + i;
                    } else {
                      pageNum = usersData.page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        disabled={searchLoading}
                        className={`px-3 py-1.5 text-xs rounded-control border transition-colors ${
                          pageNum === usersData.page
                            ? "bg-primary text-white border-primary"
                            : "border-border text-secondary hover:bg-white"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => goToPage(usersData.page + 1)}
                    disabled={usersData.page >= usersData.totalPages || searchLoading}
                    className="px-3 py-1.5 text-xs rounded-control border border-border text-secondary hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Nästa
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tags tab */}
      {activeTab === "tags" && (
        <Card>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-primary-light text-primary"
              >
                <span>{tag.name}</span>
                <button
                  onClick={() => handleDeleteTag(tag.id, tag.name)}
                  disabled={isPending}
                  className="ml-0.5 text-error hover:text-error-dark disabled:opacity-50 leading-none"
                  title="Ta bort"
                >
                  &times;
                </button>
              </div>
            ))}

            {addingTag ? (
              <input
                autoFocus
                type="text"
                value={inlineTagName}
                onChange={(e) => setInlineTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleInlineAddTag(); }
                  if (e.key === "Escape") { setAddingTag(false); setInlineTagName(""); }
                }}
                onBlur={() => { if (!inlineTagName.trim()) { setAddingTag(false); setInlineTagName(""); } }}
                placeholder="Ny tagg..."
                className="inline-flex text-xs px-2.5 py-1.5 rounded-full border border-primary text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:ring-primary w-32"
              />
            ) : (
              <button
                onClick={() => { setAddingTag(true); setInlineTagName(""); }}
                disabled={isPending}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-dashed border-dimmed text-secondary hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                <span className="leading-none">+</span>
                <span>Ny tagg</span>
              </button>
            )}
          </div>
        </Card>
      )}
    </>
  );
}
