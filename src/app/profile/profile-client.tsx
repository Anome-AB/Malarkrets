"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { updateProfile, updateInterests, deleteAccount } from "@/actions/profile";
import { unblockUser } from "@/actions/blocking";

interface ProfileData {
  displayName: string;
  email: string;
  emailVerified: boolean;
  birthDate: string;
  gender: string;
  location: string;
}

interface TagItem {
  id: number;
  name: string;
  slug: string;
}

interface BlockedUser {
  id: string;
  displayName: string;
}

interface ProfileClientProps {
  profile: ProfileData;
  currentInterestIds: number[];
  allTags: TagItem[];
  blockedUsers: BlockedUser[];
}

export function ProfileClient({
  profile,
  currentInterestIds,
  allTags,
  blockedUsers: initialBlocked,
}: ProfileClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Profile form state
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [birthDate, setBirthDate] = useState(profile.birthDate);
  const [gender, setGender] = useState(profile.gender);
  const [location, setLocation] = useState(profile.location);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Interest state
  const [selectedTags, setSelectedTags] = useState<number[]>(currentInterestIds);
  const [savingInterests, setSavingInterests] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  const filteredTags = useMemo(() => {
    if (!tagSearch.trim()) return allTags;
    const q = tagSearch.toLowerCase();
    return allTags.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTags, tagSearch]);

  // Blocked users state
  const [blockedUsers, setBlockedUsers] = useState(initialBlocked);

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      if (displayName) formData.set("displayName", displayName);
      if (birthDate) formData.set("birthDate", birthDate);
      if (gender) formData.set("gender", gender);
      if (location) formData.set("location", location);

      const result = await updateProfile(formData);
      if (result.success) {
        toast("Profilen har uppdaterats", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  function toggleTag(tagId: number) {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }

  function handleSaveInterests() {
    if (selectedTags.length < 3) {
      toast("Välj minst 3 intressen", "error");
      return;
    }
    setSavingInterests(true);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("tagIds", JSON.stringify(selectedTags));
      const result = await updateInterests(formData);
      setSavingInterests(false);
      if (result.success) {
        toast("Intressen sparade", "success");
        router.refresh();
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  async function handleUnblock(blockedId: string) {
    const result = await unblockUser(blockedId);
    if (result.success) {
      setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
      toast("Användaren har avblockerats", "success");
    } else {
      toast(result.error ?? "Något gick fel", "error");
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Personal info */}
      <Card title="Personlig information" className="space-y-4">
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <Input
            label="Visningsnamn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ditt namn"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-heading">
              E-post
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-heading">{profile.email}</span>
              {profile.emailVerified ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium">
                  Verifierad
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-alert-bg text-alert-text font-medium">
                  Ej verifierad
                </span>
              )}
            </div>
          </div>

          <Input
            label="Födelsedatum"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="gender"
              className="text-sm font-medium text-heading"
            >
              Kön
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 min-h-touch-target rounded-[8px] border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary"
            >
              <option value="ej_angett">Ej angivet</option>
              <option value="kvinna">Kvinna</option>
              <option value="man">Man</option>
            </select>
          </div>

          <Input
            label="Ort"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="T.ex. Västerås"
          />

          <div className="flex justify-end">
            <Button type="submit" loading={isPending}>
              Spara ändringar
            </Button>
          </div>
        </form>
      </Card>

      {/* Interests */}
      <Card title="Mina intressen">
        <p className="text-sm text-secondary mb-3">
          Välj minst 3 intressen. Dessa styr vilka aktiviteter du ser.
        </p>
        <input
          type="search"
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          placeholder="Sök intressen..."
          className="w-full px-3 py-2 mb-3 rounded-[8px] border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary text-sm"
        />
        <div className="flex flex-wrap gap-2 mb-4">
          {filteredTags.map((tag) => (
            <Tag
              key={tag.id}
              label={tag.name}
              active={selectedTags.includes(tag.id)}
              onClick={() => toggleTag(tag.id)}
            />
          ))}
          {filteredTags.length === 0 && tagSearch.trim() && (
            <p className="text-xs text-dimmed">
              Inga intressen matchar "{tagSearch}"
            </p>
          )}
        </div>
        <p className="text-xs text-dimmed mb-3">
          {selectedTags.length} av minst 3 valda
        </p>
        <div className="flex justify-end">
          <Button
            onClick={handleSaveInterests}
            loading={savingInterests}
            disabled={selectedTags.length < 3}
          >
            Spara intressen
          </Button>
        </div>
      </Card>

      {/* Blocked users */}
      <Card title="Blockerade användare">
        {blockedUsers.length === 0 ? (
          <p className="text-sm text-secondary">
            Du har inte blockerat någon.
          </p>
        ) : (
          <ul className="space-y-3">
            {blockedUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between bg-white border border-border rounded-lg p-3"
              >
                <span className="text-sm text-heading">
                  {user.displayName}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUnblock(user.id)}
                >
                  Avblockera
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Danger zone */}
      <Card variant="danger" title="Farligt område">
        <p className="text-sm text-secondary mb-6">
          Att radera ditt konto går inte att ångra. All data tas bort permanent.
        </p>
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Radera mitt konto
        </Button>
        <ConfirmDialog
          open={showDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            setShowDeleteConfirm(false);
            await deleteAccount();
          }}
          title="Radera ditt konto"
          message="Är du säker? Ditt konto och all data raderas permanent. Detta kan inte ångras."
          confirmLabel="Radera mitt konto"
          variant="danger"
        />
      </Card>
    </div>
  );
}
