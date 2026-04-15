"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { updateActivity, cancelOrDeleteActivity } from "@/actions/activities";
import { Card } from "@/components/ui/card";
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete";
import { ImageUpload } from "@/components/ui/image-upload";
import { CancelActivityModal } from "@/components/activity/cancel-activity-modal";
import Link from "next/link";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
}

interface FormValues {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  maxParticipants: string;
  minAge: string;
  experienceLevel: string;
  whoComes: string;
  latePolicy: string;
}

const AUDIENCE_OPTIONS = [
  { value: "alla", label: "Alla" },
  { value: "par", label: "Par" },
  { value: "familj", label: "Familjer" },
] as const;

function toLocalDatetimeString(date: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
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
  const [participantCount, setParticipantCount] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Location state
  const [locationText, setLocationText] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Gender state
  const [userGender, setUserGender] = useState<string>("ej_angett");
  const [genderOpen, setGenderOpen] = useState(false);

  // Audience state
  const [audience, setAudience] = useState<string>("alla");

  // Image state
  const [image, setImage] = useState<{
    thumbUrl: string | null;
    mediumUrl: string | null;
    ogUrl: string | null;
  }>({ thumbUrl: null, mediumUrl: null, ogUrl: null });
  const [colorTheme, setColorTheme] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    async function fetchData() {
      try {
        const [actRes, intRes] = await Promise.all([
          fetch(`/api/activity/${activityId}`),
          fetch("/api/user-interests"),
        ]);

        if (!actRes.ok) {
          setLoadError(actRes.status === 403
            ? "Du kan bara redigera dina egna aktiviteter"
            : "Kunde inte ladda aktiviteten");
          return;
        }

        const { activity } = await actRes.json();
        const intData = intRes.ok ? await intRes.json() : { interests: [], gender: "ej_angett" };

        setUserInterests(intData.interests ?? []);
        if (intData.gender) setUserGender(intData.gender);
        setSelectedTags(activity.tags ?? []);
        setParticipantCount(activity.participantCount ?? 0);
        setLocationText(activity.location ?? "");
        if (activity.latitude && activity.longitude) {
          setCoordinates({ lat: activity.latitude, lng: activity.longitude });
        }
        setImage({
          thumbUrl: activity.imageThumbUrl ?? null,
          mediumUrl: activity.imageMediumUrl ?? null,
          ogUrl: activity.imageOgUrl ?? null,
        });
        setColorTheme(activity.colorTheme ?? null);
        setGenderOpen(activity.genderRestriction !== "alla");

        const wte = activity.whatToExpect ?? {};

        // Map audience: support new single value + old values
        if (typeof wte.audience === "string" && ["alla", "par", "familj"].includes(wte.audience)) {
          setAudience(wte.audience);
        } else {
          setAudience("alla");
        }

        reset({
          title: activity.title ?? "",
          description: activity.description ?? "",
          startTime: toLocalDatetimeString(activity.startTime),
          endTime: toLocalDatetimeString(activity.endTime),
          maxParticipants: activity.maxParticipants?.toString() ?? "",
          minAge: activity.minAge?.toString() ?? "",
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

  async function handleCancel(reason: string) {
    setCancelLoading(true);
    const result = await cancelOrDeleteActivity(activityId, reason);
    setCancelLoading(false);

    if (result.success) {
      setShowCancelModal(false);
      if ((result as any).deleted) {
        toast("Aktiviteten har raderats", "success");
        router.push("/my-activities");
      } else {
        toast("Aktiviteten har ställts in", "success");
        router.push(`/activity/${activityId}`);
      }
    } else {
      toast(result.error ?? "Något gick fel", "error");
    }
  }

  function toggleTag(tagId: number) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  const handlePlaceSelect = useCallback((place: { address: string; lat: number; lng: number }) => {
    setLocationText(place.address);
    setCoordinates({ lat: place.lat, lng: place.lng });
  }, []);

  function onSubmit(values: FormValues) {
    if (selectedTags.length === 0) {
      toast("Välj minst en intressetagg", "error");
      return;
    }
    if (!locationText.trim()) {
      toast("Ange en plats", "error");
      return;
    }
    if (!image.thumbUrl && !colorTheme) {
      toast("Välj en bild eller en bakgrundsfärg", "error");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", activityId);
      formData.set("title", values.title);
      formData.set("description", values.description);
      formData.set("location", locationText);
      if (coordinates) {
        formData.set("latitude", String(coordinates.lat));
        formData.set("longitude", String(coordinates.lng));
      }
      formData.set("imageThumbUrl", image.thumbUrl ?? "");
      formData.set("imageMediumUrl", image.mediumUrl ?? "");
      formData.set("imageOgUrl", image.ogUrl ?? "");
      formData.set("colorTheme", colorTheme ?? "");
      formData.set("startTime", values.startTime);
      if (values.endTime) formData.set("endTime", values.endTime);
      if (values.maxParticipants) formData.set("maxParticipants", values.maxParticipants);
      const restriction = genderOpen
        ? (userGender === "kvinna" ? "kvinnor" : userGender === "man" ? "man" : "alla")
        : "alla";
      formData.set("genderRestriction", restriction);
      if (values.minAge) formData.set("minAge", values.minAge);
      formData.set("tags", JSON.stringify(selectedTags));
      formData.set("whatToExpect", JSON.stringify({
        audience,
        experienceLevel: values.experienceLevel,
        whoComes: values.whoComes || undefined,
        latePolicy: values.latePolicy || undefined,
      }));

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
      <div className="px-6 py-8">
        <p className="text-secondary">Laddar aktivitet...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-6 py-8">
        <p className="text-error mb-4">{loadError}</p>
        <Link href={`/activity/${activityId}`} className="text-primary underline">
          Tillbaka till aktiviteten
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 pt-8 flex flex-col min-h-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-heading">Redigera aktivitet</h1>
        <Link
          href={`/activity/${activityId}`}
          className="text-sm text-secondary hover:text-heading transition-colors"
        >
          Avbryt
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-6 items-start">
            <Card title="Grundläggande information" className="space-y-4">
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
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-description" className="text-sm font-medium text-heading">Beskrivning</label>
                <textarea
                  id="edit-description"
                  rows={4}
                  placeholder="Berätta mer om aktiviteten..."
                  className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                  {...register("description", {
                    required: "Beskrivning krävs",
                    minLength: { value: 10, message: "Minst 10 tecken" },
                    maxLength: { value: 5000, message: "Max 5000 tecken" },
                  })}
                />
                {errors.description && <p className="text-sm text-error">{errors.description.message}</p>}
              </div>
              <PlacesAutocomplete
                value={locationText}
                onChange={setLocationText}
                onPlaceSelect={handlePlaceSelect}
                placeholder="Var ska det hållas?"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Starttid"
                  type="datetime-local"
                  {...register("startTime", { required: "Starttid krävs" })}
                  error={errors.startTime?.message}
                />
                <Input
                  label="Sluttid (valfritt)"
                  type="datetime-local"
                  {...register("endTime")}
                />
              </div>
            </Card>

            <Card title="Bild eller färg">
              <ImageUpload
                thumbUrl={image.thumbUrl}
                mediumUrl={image.mediumUrl}
                ogUrl={image.ogUrl}
                colorTheme={colorTheme}
                onChange={setImage}
                onColorChange={setColorTheme}
              />
            </Card>

            <Card title="Vad kan deltagare förvänta sig?" className="space-y-4">
              <div>
                <label className="text-sm font-medium text-heading mb-1 block">
                  Vem passar aktiviteten för?
                </label>
                <div className="inline-flex rounded-[8px] border border-border overflow-hidden">
                  {AUDIENCE_OPTIONS.map((opt, i) => {
                    const active = audience === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAudience(opt.value)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                          active
                            ? "bg-primary text-white"
                            : "bg-white text-secondary hover:bg-background"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-experienceLevel" className="text-sm font-medium text-heading">Erfarenhetsnivå</label>
                <select
                  id="edit-experienceLevel"
                  className="w-full px-3 py-2 min-h-[44px] rounded-[8px] border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary"
                  {...register("experienceLevel")}
                >
                  <option value="alla">Alla nivåer</option>
                  <option value="nyborjare">Nybörjare</option>
                  <option value="medel">Medel</option>
                  <option value="avancerad">Avancerad</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-whoComes" className="text-sm font-medium text-heading">Vilka brukar komma? (valfritt)</label>
                <textarea
                  id="edit-whoComes"
                  rows={2}
                  placeholder="T.ex. 'Blandad ålder, mest nybörjare'"
                  className="w-full px-3 py-2 rounded-[8px] border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                  {...register("whoComes", { maxLength: { value: 500, message: "Max 500 tecken" } })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-latePolicy" className="text-sm font-medium text-heading">Om jag är sen? (valfritt)</label>
                <textarea
                  id="edit-latePolicy"
                  rows={2}
                  placeholder="T.ex. 'Kom när du kan, vi börjar kl 18'"
                  className="w-full px-3 py-2 rounded-[8px] border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                  {...register("latePolicy", { maxLength: { value: 200, message: "Max 200 tecken" } })}
                />
              </div>
            </Card>

            <Card title="Begränsningar" className="space-y-4">
              <Input
                label="Max antal deltagare?"
                type="number"
                min={2}
                max={500}
                placeholder="Obegränsat"
                {...register("maxParticipants")}
              />
              <Input
                label="Åldersgräns?"
                type="number"
                min={0}
                max={120}
                placeholder="Ingen"
                {...register("minAge")}
              />
              {userGender !== "ej_angett" && (
                <div>
                  <label className="text-sm font-medium text-heading mb-1 block">Aktiviteten är öppen för</label>
                  <div className="inline-flex rounded-[8px] border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGenderOpen(false)}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        !genderOpen
                          ? "bg-primary text-white"
                          : "bg-white text-secondary hover:bg-background"
                      }`}
                    >
                      Alla
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenderOpen(true)}
                      className={`px-4 py-2 text-sm font-medium border-l border-border transition-colors ${
                        genderOpen
                          ? "bg-primary text-white"
                          : "bg-white text-secondary hover:bg-background"
                      }`}
                    >
                      Endast {userGender === "kvinna" ? "kvinnor" : "män"}
                    </button>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Intressetaggar">
              {userInterests.length === 0 ? (
                <p className="text-sm text-secondary">
                  Du har inga intressen valda.{" "}
                  <a href="/onboarding" className="text-primary underline">Välj intressen</a>
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
                <p className="text-xs text-dimmed mt-2">Välj minst en tagg</p>
              )}
            </Card>
        </div>

        {/* Sticky footer — pushed to bottom of viewport */}
        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.04)] mt-auto pt-3 flex justify-between items-center gap-3 z-10">
          <Button variant="danger" onClick={() => setShowCancelModal(true)}>
            {participantCount > 0 ? "Ställ in aktivitet" : "Radera aktivitet"}
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            Spara ändringar
          </Button>
        </div>
      </form>

      <CancelActivityModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        participantCount={participantCount}
        loading={cancelLoading}
      />
    </div>
  );
}
