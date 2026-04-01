"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { createActivity } from "@/actions/activities";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
}

interface FormValues {
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  maxParticipants: string;
  genderRestriction: string;
  minAge: string;
  okAlone: boolean;
  experienceLevel: string;
  whoComes: string;
  latePolicy: string;
}

export default function CreateActivityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [userInterests, setUserInterests] = useState<InterestTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      genderRestriction: "alla",
      experienceLevel: "alla",
      okAlone: true,
    },
  });

  // Fetch user interests client-side
  useEffect(() => {
    async function fetchInterests() {
      try {
        const res = await fetch("/api/user-interests");
        if (res.ok) {
          const data = await res.json();
          setUserInterests(data.interests ?? []);
        }
      } catch {
        // Silently fail, user can still create activity without tags shown
      } finally {
        setLoadingTags(false);
      }
    }
    fetchInterests();
  }, []);

  function toggleTag(tagId: number) {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }

  function onSubmit(values: FormValues) {
    if (selectedTags.length === 0) {
      toast("Välj minst en intressetagg", "error");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", values.title);
      formData.set("description", values.description);
      formData.set("location", values.location);
      formData.set("startTime", values.startTime);
      if (values.endTime) formData.set("endTime", values.endTime);
      if (values.maxParticipants)
        formData.set("maxParticipants", values.maxParticipants);
      formData.set("genderRestriction", values.genderRestriction);
      if (values.minAge) formData.set("minAge", values.minAge);
      formData.set("tags", JSON.stringify(selectedTags));
      formData.set(
        "whatToExpect",
        JSON.stringify({
          okAlone: values.okAlone,
          experienceLevel: values.experienceLevel,
          whoComes: values.whoComes || undefined,
          latePolicy: values.latePolicy || undefined,
        }),
      );

      const result = await createActivity(formData);

      if (result.success && result.activityId) {
        toast("Aktiviteten har skapats!", "success");
        router.push(`/activity/${result.activityId}`);
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-[#2d2d2d] mb-6">Skapa ny aktivitet</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <Input
            label="Titel"
            placeholder="Vad ska ni göra?"
            {...register("title", {
              required: "Titel krävs",
              minLength: { value: 3, message: "Minst 3 tecken" },
              maxLength: { value: 200, message: "Max 200 tecken" },
            })}
            error={errors.title?.message}
          />

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="description"
              className="text-sm font-medium text-[#2d2d2d]"
            >
              Beskrivning
            </label>
            <textarea
              id="description"
              rows={4}
              placeholder="Berätta mer om aktiviteten..."
              className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y"
              {...register("description", {
                required: "Beskrivning krävs",
                minLength: { value: 10, message: "Minst 10 tecken" },
                maxLength: { value: 5000, message: "Max 5000 tecken" },
              })}
            />
            {errors.description && (
              <p className="text-sm text-[#dc3545]">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Location */}
          <Input
            label="Plats"
            placeholder="Var ska det hållas?"
            {...register("location", {
              required: "Plats krävs",
              minLength: { value: 2, message: "Minst 2 tecken" },
              maxLength: { value: 500, message: "Max 500 tecken" },
            })}
            error={errors.location?.message}
          />

          {/* Start time */}
          <Input
            label="Starttid"
            type="datetime-local"
            {...register("startTime", {
              required: "Starttid krävs",
            })}
            error={errors.startTime?.message}
          />

          {/* End time (optional) */}
          <Input
            label="Sluttid (valfritt)"
            type="datetime-local"
            {...register("endTime")}
          />

          {/* Max participants */}
          <Input
            label="Max antal deltagare (valfritt)"
            type="number"
            min={2}
            max={500}
            placeholder="Lämna tomt för obegränsat"
            {...register("maxParticipants")}
          />

          {/* Gender restriction */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="genderRestriction"
              className="text-sm font-medium text-[#2d2d2d]"
            >
              Könsbegränsning
            </label>
            <select
              id="genderRestriction"
              className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e]"
              {...register("genderRestriction")}
            >
              <option value="alla">Alla</option>
              <option value="kvinnor">Kvinnor</option>
              <option value="man">Män</option>
            </select>
          </div>

          {/* Min age (optional) */}
          <Input
            label="Lägsta ålder (valfritt)"
            type="number"
            min={0}
            max={120}
            {...register("minAge")}
          />

          {/* Interest tags */}
          <div>
            <label className="text-sm font-medium text-[#2d2d2d] block mb-2">
              Intressetaggar
            </label>
            {loadingTags ? (
              <p className="text-sm text-[#666666]">Laddar taggar...</p>
            ) : userInterests.length === 0 ? (
              <p className="text-sm text-[#666666]">
                Du har inga intressen valda.{" "}
                <a href="/onboarding" className="text-[#3d6b5e] underline">
                  Välj intressen
                </a>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {userInterests.map((tag) => (
                  <Tag
                    key={tag.id}
                    label={tag.name}
                    active={selectedTags.includes(tag.id)}
                    onClick={() => toggleTag(tag.id)}
                  />
                ))}
              </div>
            )}
            {selectedTags.length === 0 && (
              <p className="text-xs text-[#999999] mt-1">
                Välj minst en tagg
              </p>
            )}
          </div>

          {/* What to expect */}
          <fieldset className="border border-[#dddddd] rounded-lg p-4 space-y-4">
            <legend className="text-sm font-semibold text-[#2d2d2d] px-2">
              Vad kan deltagare förvänta sig?
            </legend>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-[#dddddd] text-[#3d6b5e] focus:ring-[#3d6b5e]"
                {...register("okAlone")}
              />
              <span className="text-sm text-[#2d2d2d]">
                Okej att komma ensam
              </span>
            </label>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="experienceLevel"
                className="text-sm font-medium text-[#2d2d2d]"
              >
                Erfarenhetsnivå
              </label>
              <select
                id="experienceLevel"
                className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e]"
                {...register("experienceLevel")}
              >
                <option value="alla">Alla nivåer</option>
                <option value="nyborjare">Nybörjare</option>
                <option value="medel">Medel</option>
                <option value="avancerad">Avancerad</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="whoComes"
                className="text-sm font-medium text-[#2d2d2d]"
              >
                Vilka brukar komma? (valfritt)
              </label>
              <textarea
                id="whoComes"
                rows={2}
                placeholder="T.ex. 'Blandad ålder, mest nybörjare'"
                className="w-full px-3 py-2 rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y"
                {...register("whoComes", {
                  maxLength: { value: 500, message: "Max 500 tecken" },
                })}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="latePolicy"
                className="text-sm font-medium text-[#2d2d2d]"
              >
                Om jag är sen? (valfritt)
              </label>
              <textarea
                id="latePolicy"
                rows={2}
                placeholder="T.ex. 'Kom när du kan, vi börjar kl 18'"
                className="w-full px-3 py-2 rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y"
                {...register("latePolicy", {
                  maxLength: { value: 200, message: "Max 200 tecken" },
                })}
              />
            </div>
          </fieldset>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isPending}
              className="w-full"
            >
              Skapa aktivitet
            </Button>
          </div>
        </form>
    </div>
  );
}
