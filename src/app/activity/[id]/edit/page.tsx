"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { updateActivity } from "@/actions/activities";
import Link from "next/link";

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

function toLocalDatetimeString(date: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  // Format: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditActivityPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const activityId = params.id;
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [userInterests, setUserInterests] = useState<InterestTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  // Fetch activity data and user interests
  useEffect(() => {
    async function fetchData() {
      try {
        const [actRes, intRes] = await Promise.all([
          fetch(`/api/activity/${activityId}`),
          fetch("/api/user-interests"),
        ]);

        if (!actRes.ok) {
          if (actRes.status === 403) {
            setLoadError("Du kan bara redigera dina egna aktiviteter");
          } else {
            setLoadError("Kunde inte ladda aktiviteten");
          }
          return;
        }

        const { activity } = await actRes.json();
        const intData = intRes.ok ? await intRes.json() : { interests: [] };

        setUserInterests(intData.interests ?? []);
        setSelectedTags(activity.tags ?? []);

        const wte = activity.whatToExpect ?? {};

        reset({
          title: activity.title ?? "",
          description: activity.description ?? "",
          location: activity.location ?? "",
          startTime: toLocalDatetimeString(activity.startTime),
          endTime: toLocalDatetimeString(activity.endTime),
          maxParticipants: activity.maxParticipants?.toString() ?? "",
          genderRestriction: activity.genderRestriction ?? "alla",
          minAge: activity.minAge?.toString() ?? "",
          okAlone: wte.okAlone ?? true,
          experienceLevel: wte.experienceLevel ?? "alla",
          whoComes: wte.whoComes ?? "",
          latePolicy: wte.latePolicy ?? "",
        });
      } catch {
        setLoadError("Kunde inte ladda aktiviteten");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activityId, reset]);

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
      formData.set("id", activityId);
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

      const result = await updateActivity(formData);

      if (result.success) {
        toast("Aktiviteten har uppdaterats!", "success");
        router.push(`/activity/${activityId}`);
      } else {
        toast(result.error ?? "Något gick fel", "error");
      }
    });
  }

  if (loading) {
    return (
      <div className="max-w-3xl px-6 py-8">
        <p className="text-[#666666]">Laddar aktivitet...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl px-6 py-8">
        <p className="text-[#dc3545] mb-4">{loadError}</p>
        <Link
          href={`/activity/${activityId}`}
          className="text-[#3d6b5e] underline"
        >
          Tillbaka till aktiviteten
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#2d2d2d]">Redigera aktivitet</h1>
        <Link
          href={`/activity/${activityId}`}
          className="text-sm text-[#666666] hover:text-[#2d2d2d] transition-colors"
        >
          Avbryt
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Card: Grundläggande information */}
        <div className="bg-white border border-[#dddddd] rounded-[10px] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#2d2d2d]">Grundläggande information</h2>
          <Input label="Titel" placeholder="Vad ska ni göra?" {...register("title", { required: "Titel krävs", minLength: { value: 3, message: "Minst 3 tecken" }, maxLength: { value: 200, message: "Max 200 tecken" } })} error={errors.title?.message} />
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-description" className="text-sm font-medium text-[#2d2d2d]">Beskrivning</label>
            <textarea id="edit-description" rows={4} placeholder="Berätta mer om aktiviteten..." className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y" {...register("description", { required: "Beskrivning krävs", minLength: { value: 10, message: "Minst 10 tecken" }, maxLength: { value: 5000, message: "Max 5000 tecken" } })} />
            {errors.description && <p className="text-sm text-[#dc3545]">{errors.description.message}</p>}
          </div>
          <Input label="Plats" placeholder="Var ska det hållas?" {...register("location", { required: "Plats krävs", minLength: { value: 2, message: "Minst 2 tecken" }, maxLength: { value: 500, message: "Max 500 tecken" } })} error={errors.location?.message} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Starttid" type="datetime-local" {...register("startTime", { required: "Starttid krävs" })} error={errors.startTime?.message} />
            <Input label="Sluttid (valfritt)" type="datetime-local" {...register("endTime")} />
          </div>
        </div>

        {/* Card: Begränsningar */}
        <div className="bg-white border border-[#dddddd] rounded-[10px] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#2d2d2d]">Begränsningar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Max deltagare (valfritt)" type="number" min={2} max={500} placeholder="Obegränsat" {...register("maxParticipants")} />
            <div className="flex flex-col gap-1">
              <label htmlFor="edit-genderRestriction" className="text-sm font-medium text-[#2d2d2d]">Könsbegränsning</label>
              <select id="edit-genderRestriction" className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e]" {...register("genderRestriction")}>
                <option value="alla">Alla</option>
                <option value="kvinnor">Kvinnor</option>
                <option value="man">Män</option>
              </select>
            </div>
            <Input label="Lägsta ålder (valfritt)" type="number" min={0} max={120} placeholder="Ingen" {...register("minAge")} />
          </div>
        </div>

        {/* Card: Intressetaggar */}
        <div className="bg-white border border-[#dddddd] rounded-[10px] p-6">
          <h2 className="text-base font-semibold text-[#2d2d2d] mb-3">Intressetaggar</h2>
          {userInterests.length === 0 ? (
            <p className="text-sm text-[#666666]">Du har inga intressen valda. <a href="/onboarding" className="text-[#3d6b5e] underline">Välj intressen</a></p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {userInterests.map((tag) => (
                <Tag key={tag.id} label={tag.name} active={selectedTags.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
              ))}
            </div>
          )}
          {selectedTags.length === 0 && <p className="text-xs text-[#999999] mt-2">Välj minst en tagg</p>}
        </div>

        {/* Card: Vad kan deltagare förvänta sig? */}
        <div className="bg-white border border-[#dddddd] rounded-[10px] p-6 space-y-4">
          <h2 className="text-base font-semibold text-[#2d2d2d]">Vad kan deltagare förvänta sig?</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 rounded border-[#dddddd] text-[#3d6b5e] focus:ring-[#3d6b5e]" {...register("okAlone")} />
            <span className="text-sm text-[#2d2d2d]">Okej att komma ensam</span>
          </label>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-experienceLevel" className="text-sm font-medium text-[#2d2d2d]">Erfarenhetsnivå</label>
            <select id="edit-experienceLevel" className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e]" {...register("experienceLevel")}>
              <option value="alla">Alla nivåer</option>
              <option value="nyborjare">Nybörjare</option>
              <option value="medel">Medel</option>
              <option value="avancerad">Avancerad</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-whoComes" className="text-sm font-medium text-[#2d2d2d]">Vilka brukar komma? (valfritt)</label>
            <textarea id="edit-whoComes" rows={2} placeholder="T.ex. 'Blandad ålder, mest nybörjare'" className="w-full px-3 py-2 rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y" {...register("whoComes", { maxLength: { value: 500, message: "Max 500 tecken" } })} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-latePolicy" className="text-sm font-medium text-[#2d2d2d]">Om jag är sen? (valfritt)</label>
            <textarea id="edit-latePolicy" rows={2} placeholder="T.ex. 'Kom när du kan, vi börjar kl 18'" className="w-full px-3 py-2 rounded-[8px] border border-[#dddddd] text-[#2d2d2d] bg-white placeholder:text-[#999999] focus:outline-none focus:ring-1 focus:border-[#3d6b5e] focus:ring-[#3d6b5e] resize-y" {...register("latePolicy", { maxLength: { value: 200, message: "Max 200 tecken" } })} />
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button type="submit" variant="primary" size="lg" loading={isPending} className="w-full">
            Spara ändringar
          </Button>
        </div>
      </form>
    </div>
  );
}
