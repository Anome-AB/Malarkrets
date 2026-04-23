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
import { randomCourageMessage, randomFromList } from "@/lib/courage-messages";
import {
  combineDateTime,
  combineEndDateTime,
  toDateInput,
  toTimeInput,
} from "@/lib/datetime";
import Link from "next/link";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
}

interface FormValues {
  title: string;
  description: string;
  date: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  maxParticipants: string;
  minAge: string;
  experienceLevel: string;
  whoComes: string;
  latePolicy: string;
  adminReason: string;
}

const AUDIENCE_OPTIONS = [
  { value: "alla", label: "Alla" },
  { value: "par", label: "Par" },
  { value: "familj", label: "Familjer" },
] as const;

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

  // Gender state (creator-owned: in admin mode we display the creator's gender instead of the viewer's)
  const [userGender, setUserGender] = useState<string>("ej_angett");
  const [genderOpen, setGenderOpen] = useState(false);

  // Admin-mode flags
  const [isAdminEdit, setIsAdminEdit] = useState(false);
  const [creatorDisplayName, setCreatorDisplayName] = useState<string | null>(null);

  // Audience state
  const [audience, setAudience] = useState<string>("alla");

  // Image state
  const [image, setImage] = useState<{
    thumbUrl: string | null;
    mediumUrl: string | null;
    ogUrl: string | null;
    accentColor: string | null;
  }>({ thumbUrl: null, mediumUrl: null, ogUrl: null, accentColor: null });
  const [colorTheme, setColorTheme] = useState<string | null>(null);

  // Courage message state. lastAutoCourage tracks the most recent auto-
  // suggested message so we know whether to re-roll on audience change
  // (only if the user hasn't manually edited the field).
  const [courageEnabled, setCourageEnabled] = useState(false);
  const [courageText, setCourageText] = useState("");
  const [lastAutoCourage, setLastAutoCourage] = useState<string | null>(null);

  const fetchCourageMessagesFor = useCallback(async (aud: string): Promise<string[]> => {
    try {
      const res = await fetch(`/api/courage-messages?audience=${aud}`);
      if (res.ok) {
        const data = await res.json();
        return data.messages ?? [];
      }
    } catch { /* fall through to fallback */ }
    return [];
  }, []);

  const applyCourageSuggestion = useCallback(async (aud: string) => {
    const list = await fetchCourageMessagesFor(aud);
    const message = list.length > 0 ? randomFromList(list, aud) : randomCourageMessage(aud);
    setCourageText(message);
    setLastAutoCourage(message);
  }, [fetchCourageMessagesFor]);

  const handleAudienceChange = useCallback(async (value: string) => {
    setAudience(value);
    if (courageEnabled && courageText === lastAutoCourage) {
      await applyCourageSuggestion(value);
    }
  }, [courageEnabled, courageText, lastAutoCourage, applyCourageSuggestion]);

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

        const adminEditing = !!activity.viewerIsAdmin && !activity.viewerIsCreator;
        setIsAdminEdit(adminEditing);
        setCreatorDisplayName(activity.creatorDisplayName ?? null);

        // Tag picker must show the creator's interests when an admin edits,
        // not the admin's own — otherwise the admin's tags would leak in and
        // the creator's existing tags could disappear from the picker.
        const interestsForPicker = adminEditing
          ? (activity.creatorInterests ?? [])
          : (intData.interests ?? []);
        setUserInterests(interestsForPicker);
        // Gender toggle UI reflects the creator's gender when an admin is editing —
        // otherwise gender semantics would be incorrect (toggle would read "Endast kvinnor"
        // based on the admin's gender, not the creator's).
        const genderForToggle = adminEditing
          ? (activity.creatorGender ?? "ej_angett")
          : (intData.gender ?? "ej_angett");
        setUserGender(genderForToggle);
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
          accentColor: activity.imageAccentColor ?? null,
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

        // Pre-populate courage message
        if (wte.courageMessage) {
          setCourageEnabled(true);
          setCourageText(wte.courageMessage);
        }

        reset({
          title: activity.title ?? "",
          description: activity.description ?? "",
          date: toDateInput(activity.startTime),
          startTimeOfDay: toTimeInput(activity.startTime),
          endTimeOfDay: toTimeInput(activity.endTime),
          maxParticipants: activity.maxParticipants?.toString() ?? "",
          minAge: activity.minAge?.toString() ?? "",
          experienceLevel: wte.experienceLevel ?? "alla",
          whoComes: wte.whoComes ?? "",
          latePolicy: wte.latePolicy ?? "",
          adminReason: "",
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
      if ((result as { deleted?: boolean }).deleted) {
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
      formData.set("imageAccentColor", image.accentColor ?? "");
      formData.set("colorTheme", colorTheme ?? "");
      const startCombined = combineDateTime(
        values.date,
        values.startTimeOfDay,
      );
      if (!startCombined) {
        toast("Ange datum och starttid", "error");
        return;
      }
      const endCombined = combineEndDateTime(
        values.date,
        values.startTimeOfDay,
        values.endTimeOfDay,
      );
      formData.set("startTime", startCombined);
      if (endCombined) formData.set("endTime", endCombined);
      if (values.maxParticipants) formData.set("maxParticipants", values.maxParticipants);
      const restriction = genderOpen
        ? (userGender === "kvinna" ? "kvinnor" : userGender === "man" ? "man" : "alla")
        : "alla";
      formData.set("genderRestriction", restriction);
      if (values.minAge) formData.set("minAge", values.minAge);
      formData.set("tags", JSON.stringify(selectedTags));
      const courageMessage = courageEnabled && courageText.trim() ? courageText.trim() : undefined;
      formData.set("whatToExpect", JSON.stringify({
        audience,
        experienceLevel: values.experienceLevel,
        whoComes: values.whoComes || undefined,
        latePolicy: values.latePolicy || undefined,
        ...(courageMessage ? { courageMessage } : {}),
      }));
      if (isAdminEdit) {
        formData.set("adminReason", values.adminReason);
      }

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
        <div>
          <h1 className="text-2xl font-bold text-heading">
            {isAdminEdit ? "Redigera aktivitet som admin" : "Redigera aktivitet"}
          </h1>
          {isAdminEdit && creatorDisplayName && (
            <p className="text-sm text-secondary mt-1">
              Arrangör: <span className="font-medium text-heading">{creatorDisplayName}</span>
            </p>
          )}
        </div>
        <Link
          href={`/activity/${activityId}`}
          className="text-sm text-secondary hover:text-heading transition-colors"
        >
          Avbryt
        </Link>
      </div>

      {isAdminEdit && (
        <Card className="mb-6 !bg-info-light border-info/30">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-admin-reason" className="text-sm font-semibold text-info">
              Anledning till ändring <span className="text-error">*</span>
            </label>
            <p className="text-xs text-secondary mb-1">
              Arrangören får en notis med anledningen och en lista över de fält du ändrat.
            </p>
            <textarea
              id="edit-admin-reason"
              rows={3}
              placeholder="Beskriv varför du redigerar (minst 10 tecken)"
              className="w-full px-3 py-2 rounded-control border border-info/40 text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-info focus:ring-info resize-y"
              {...register("adminReason", isAdminEdit ? {
                required: "Ange en anledning (minst 10 tecken)",
                minLength: { value: 10, message: "Minst 10 tecken" },
                maxLength: { value: 500, message: "Max 500 tecken" },
              } : {})}
            />
            {errors.adminReason && (
              <p className="text-sm text-error">{errors.adminReason.message}</p>
            )}
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
        <div className="grid grid-cols-activity-form gap-6 items-start">
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
                  className="w-full px-3 py-2 min-h-touch-target rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
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
              <Input
                label="Datum"
                type="date"
                {...register("date", { required: "Datum krävs" })}
                error={errors.date?.message}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Starttid"
                  type="time"
                  {...register("startTimeOfDay", {
                    required: "Starttid krävs",
                  })}
                  error={errors.startTimeOfDay?.message}
                />
                <Input
                  label="Sluttid (valfritt)"
                  type="time"
                  {...register("endTimeOfDay")}
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
              {/* Courage message — top of card since it shows at top of CourageSection */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={courageEnabled}
                    onChange={async (e) => {
                      const enabled = e.target.checked;
                      setCourageEnabled(enabled);
                      if (enabled && !courageText) {
                        await applyCourageSuggestion(audience);
                      }
                    }}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm font-medium text-heading">Lägg till välkomstmeddelande</span>
                </label>
                <p className="text-xs text-dimmed mt-1 ml-6">
                  Visas för deltagare i aktivitetens informationsruta
                </p>

                {courageEnabled && (
                  <div className="mt-3 ml-6">
                    <div className="relative">
                      <textarea
                        rows={2}
                        maxLength={200}
                        value={courageText}
                        onChange={(e) => setCourageText(e.target.value)}
                        placeholder="Skriv ett välkomstmeddelande..."
                        className="w-full px-3 py-2 pr-10 rounded-control border border-courage-border bg-courage-bg text-heading placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => applyCourageSuggestion(audience)}
                        className="absolute top-2 right-2 p-1 rounded-md text-dimmed hover:text-primary hover:bg-white/80 transition-colors"
                        title="Nytt förslag"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-dimmed mt-1">{courageText.length}/200 tecken</p>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <label className="text-sm font-medium text-heading mb-1 block">
                  Vem passar aktiviteten för?
                </label>
                <div className="inline-flex rounded-control border border-border overflow-hidden">
                  {AUDIENCE_OPTIONS.map((opt, i) => {
                    const active = audience === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleAudienceChange(opt.value)}
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
                  className="w-full px-3 py-2 min-h-touch-target rounded-control border border-border text-heading bg-white focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary"
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
                  className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                  {...register("whoComes", { maxLength: { value: 500, message: "Max 500 tecken" } })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="edit-latePolicy" className="text-sm font-medium text-heading">Om jag är sen? (valfritt)</label>
                <textarea
                  id="edit-latePolicy"
                  rows={2}
                  placeholder="T.ex. 'Kom när du kan, vi börjar kl 18'"
                  className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
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
              {!isAdminEdit && (
                <Input
                  label="Åldersgräns?"
                  type="number"
                  min={0}
                  max={120}
                  placeholder="Ingen"
                  {...register("minAge")}
                />
              )}
              {!isAdminEdit && userGender !== "ej_angett" && (
                <div>
                  <label className="text-sm font-medium text-heading mb-1 block">Aktiviteten är öppen för</label>
                  <div className="inline-flex rounded-control border border-border overflow-hidden">
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
        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white border-t border-border shadow-sticky-footer mt-auto pt-3 flex justify-between items-center gap-3 z-10">
          {isAdminEdit ? (
            <p className="text-xs text-dimmed">
              Avboka eller ta bort görs via moderations-verktygen på aktivitetssidan.
            </p>
          ) : (
            <Button variant="danger" onClick={() => setShowCancelModal(true)}>
              {participantCount > 0 ? "Ställ in aktivitet" : "Radera aktivitet"}
            </Button>
          )}
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
