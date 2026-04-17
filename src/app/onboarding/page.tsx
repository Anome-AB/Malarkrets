"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateInterests } from "@/actions/profile";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
  userCount: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [tags, setTags] = useState<InterestTag[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchTags() {
      try {
        const res = await fetch("/api/interest-tags");
        if (res.ok) {
          const data = await res.json();
          setTags(data.tags ?? []);
        }
      } catch {
        toast("Kunde inte ladda intressen", "error");
      } finally {
        setLoading(false);
      }
    }
    fetchTags();
  }, [toast]);

  const filteredTags = useMemo(() => {
    if (!search.trim()) return tags;
    const q = search.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  function toggle(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    if (selectedIds.length < 3) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("tagIds", JSON.stringify(selectedIds));
      const result = await updateInterests(formData);

      if (result.success) {
        toast("Välkommen! Dina intressen har sparats.", "success");
        router.push("/");
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <div className="max-w-2xl w-full px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-primary mb-3">
            Välkommen till Mälarkrets!
          </h1>
          <p className="text-lg text-secondary">
            Välj minst 3 intressen för att komma igång.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-secondary">Laddar intressen...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sök intressen..."
                className="w-full px-4 py-2.5 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {filteredTags.map((tag) => (
                <Tag
                  key={tag.id}
                  label={tag.name}
                  active={selectedIds.includes(tag.id)}
                  count={tag.userCount}
                  onClick={() => toggle(tag.id)}
                />
              ))}
              {filteredTags.length === 0 && search.trim() && (
                <p className="text-sm text-dimmed">
                  Inga intressen matchar &quot;{search}&quot;
                </p>
              )}
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm text-dimmed">
                {selectedIds.length} av minst 3 valda
              </p>
              <Button
                disabled={selectedIds.length < 3}
                loading={isPending}
                onClick={handleSubmit}
              >
                Klar!
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
