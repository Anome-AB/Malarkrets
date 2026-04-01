"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "@/components/ui/tag";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateInterests } from "@/actions/profile";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  userCount: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [tags, setTags] = useState<InterestTag[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col items-center">
      <div className="max-w-2xl w-full px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[#3d6b5e] mb-3">
            Välkommen till Mälarkrets!
          </h1>
          <p className="text-lg text-[#666666]">
            Välj minst 3 intressen för att komma igång.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-[#666666]">Laddar intressen...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 justify-center mb-8">
              {tags.map((tag) => (
                <Tag
                  key={tag.id}
                  label={tag.name}
                  active={selectedIds.includes(tag.id)}
                  count={tag.userCount}
                  onClick={() => toggle(tag.id)}
                />
              ))}
            </div>

            <div className="text-center space-y-4">
              <p className="text-sm text-[#999999]">
                {selectedIds.length} av minst 3 valda
              </p>
              <Button
                size="lg"
                disabled={selectedIds.length < 3}
                loading={isPending}
                onClick={handleSubmit}
                className="min-w-[200px]"
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
