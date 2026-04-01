"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  category: string | null;
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
    <div className="space-y-10">
      {/* Personal info */}
      <section>
        <h2 className="text-lg font-semibold text-[#2d2d2d] mb-4">
          Personlig information
        </h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <Input
            label="Visningsnamn"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ditt namn"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#2d2d2d]">
              E-post
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#2d2d2d]">{profile.email}</span>
              {profile.emailVerified ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#e8f0ec] text-[#3d6b5e] font-medium">
                  Verifierad
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#fef3cd] text-[#856404] font-medium">
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
              className="text-sm font-medium text-[#2d2d2d]"
            >
              Kön
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e]"
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

          <Button type="submit" loading={isPending}>
            Spara ändringar
          </Button>
        </form>
      </section>

      {/* Interests */}
      <section>
        <h2 className="text-lg font-semibold text-[#2d2d2d] mb-2">
          Mina intressen
        </h2>
        <p className="text-sm text-[#666666] mb-4">
          Välj minst 3 intressen. Dessa styr vilka aktiviteter du ser.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map((tag) => (
            <Tag
              key={tag.id}
              label={tag.name}
              active={selectedTags.includes(tag.id)}
              onClick={() => toggleTag(tag.id)}
            />
          ))}
        </div>
        <p className="text-xs text-[#999999] mb-3">
          {selectedTags.length} av minst 3 valda
        </p>
        <Button
          onClick={handleSaveInterests}
          loading={savingInterests}
          disabled={selectedTags.length < 3}
        >
          Spara intressen
        </Button>
      </section>

      {/* Blocked users */}
      <section>
        <h2 className="text-lg font-semibold text-[#2d2d2d] mb-4">
          Blockerade användare
        </h2>
        {blockedUsers.length === 0 ? (
          <p className="text-sm text-[#666666]">
            Du har inte blockerat någon.
          </p>
        ) : (
          <ul className="space-y-3">
            {blockedUsers.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between bg-white border border-[#dddddd] rounded-lg p-3"
              >
                <span className="text-sm text-[#2d2d2d]">
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
      </section>

      {/* Danger zone */}
      <section className="mt-8 bg-red-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-[#dc3545] mb-2">
          Farligt område
        </h2>
        <p className="text-sm text-[#666666] mb-6">
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
      </section>
    </div>
  );
}
