"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete";
import { ImageUpload } from "@/components/ui/image-upload";
import { createActivity } from "@/actions/activities";
import { randomCourageMessage, randomFromList } from "@/lib/courage-messages";
import { COLOR_PRESETS } from "@/lib/color-themes";
import { combineDateTime, combineEndDateTime, toDateInput } from "@/lib/datetime";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
}

interface FormValues {
  title: string;
  description: string;
  location: string;
  date: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  maxParticipants: string;
  genderRestriction: string;
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

export default function CreateActivityPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [userInterests, setUserInterests] = useState<InterestTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [userGender, setUserGender] = useState<string>("ej_angett");
  const [genderOpen, setGenderOpen] = useState(false);
  const [locationText, setLocationText] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [audience, setAudience] = useState<string>("alla");
  const [image, setImage] = useState<{
    thumbUrl: string | null;
    mediumUrl: string | null;
    ogUrl: string | null;
    accentColor: string | null;
  }>({ thumbUrl: null, mediumUrl: null, ogUrl: null, accentColor: null });
  // Pre-seed a random preset so the user always has a valid background even
  // if they skip image upload and never touch the colour picker. Done in a
  // client-only effect so server and client render the same (null) initial
  // state; picking during useState would cause a hydration mismatch because
  // Math.random() would disagree between the two.
  const [colorTheme, setColorTheme] = useState<string | null>(null);
  useEffect(() => {
    setColorTheme((current) =>
      current ?? COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)].value,
    );
  }, []);
  const [courageEnabled, setCourageEnabled] = useState(false);
  const [courageText, setCourageText] = useState("");
  // Tracks the last auto-suggested courage message so we know whether the
  // user has manually edited the field. If yes (text != lastAutoCourage),
  // changing audience leaves the text alone. If no, switching audience
  // re-rolls a suggestion from the new audience's pool.
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
    // Re-roll the suggestion if courage is on AND the field still holds the
    // last auto-suggestion (user hasn't typed their own message). Otherwise
    // respect the manual edit.
    if (courageEnabled && courageText === lastAutoCourage) {
      await applyCourageSuggestion(value);
    }
  }, [courageEnabled, courageText, lastAutoCourage, applyCourageSuggestion]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      genderRestriction: "alla",
      experienceLevel: "alla",
      // Default to today so the date picker shows something useful on mount.
      date: toDateInput(new Date()),
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
          if (data.gender) setUserGender(data.gender);
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
    if (!locationText.trim()) {
      toast("Ange en plats", "error");
      return;
    }
    if (!image.thumbUrl && !colorTheme) {
      toast("Välj en bild eller en bakgrundsfärg", "error");
      return;
    }

    const startCombined = combineDateTime(values.date, values.startTimeOfDay);
    if (!startCombined) {
      toast("Ange datum och starttid", "error");
      return;
    }
    const endCombined = combineEndDateTime(
      values.date,
      values.startTimeOfDay,
      values.endTimeOfDay,
    );

    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", values.title);
      formData.set("description", values.description);
      formData.set("location", locationText);
      if (coordinates) {
        formData.set("latitude", String(coordinates.lat));
        formData.set("longitude", String(coordinates.lng));
      }
      if (image.thumbUrl) formData.set("imageThumbUrl", image.thumbUrl);
      if (image.mediumUrl) formData.set("imageMediumUrl", image.mediumUrl);
      if (image.ogUrl) formData.set("imageOgUrl", image.ogUrl);
      if (image.accentColor) formData.set("imageAccentColor", image.accentColor);
      if (colorTheme) formData.set("colorTheme", colorTheme);
      formData.set("startTime", startCombined);
      if (endCombined) formData.set("endTime", endCombined);
      if (values.maxParticipants)
        formData.set("maxParticipants", values.maxParticipants);
      const restriction = genderOpen
        ? (userGender === "kvinna" ? "kvinnor" : userGender === "man" ? "man" : "alla")
        : "alla";
      formData.set("genderRestriction", restriction);
      if (values.minAge) formData.set("minAge", values.minAge);
      formData.set("tags", JSON.stringify(selectedTags));
      const courageMessage = courageEnabled && courageText.trim() ? courageText.trim() : undefined;
      formData.set(
        "whatToExpect",
        JSON.stringify({
          audience,
          experienceLevel: values.experienceLevel,
          whoComes: values.whoComes || undefined,
          latePolicy: values.latePolicy || undefined,
          ...(courageMessage ? { courageMessage } : {}),
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
    <div className="px-6 pt-8 flex flex-col min-h-full">
      <h1 className="text-2xl font-bold text-heading mb-6">Skapa ny aktivitet</h1>
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
                  <label htmlFor="description" className="text-sm font-medium text-heading">Beskrivning</label>
                  <textarea
                    id="description"
                    rows={4}
                    placeholder="Berätta mer om aktiviteten..."
                    className="w-full px-3 py-2 min-h-touch-target rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                    {...register("description", {
                      required: "Beskrivning krävs",
                      minLength: { value: 10, message: "Minst 10 tecken" },
                      maxLength: { value: 5000, message: "Max 5000 tecken" },
                    })}
                  />
                  {errors.description && (
                    <p className="text-sm text-error">{errors.description.message}</p>
                  )}
                </div>
                <PlacesAutocomplete
                  value={locationText}
                  onChange={setLocationText}
                  onPlaceSelect={(place) => {
                    setLocationText(place.address);
                    setCoordinates({ lat: place.lat, lng: place.lng });
                  }}
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

              {/* Image upload */}
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

              {/* What to expect */}
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
                  <label htmlFor="experienceLevel" className="text-sm font-medium text-heading">Erfarenhetsnivå</label>
                  <select
                    id="experienceLevel"
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
                  <label htmlFor="whoComes" className="text-sm font-medium text-heading">Vilka brukar komma? (valfritt)</label>
                  <textarea
                    id="whoComes"
                    rows={2}
                    placeholder="T.ex. 'Blandad ålder, mest nybörjare'"
                    className="w-full px-3 py-2 rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary resize-y"
                    {...register("whoComes", { maxLength: { value: 500, message: "Max 500 tecken" } })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="latePolicy" className="text-sm font-medium text-heading">Om jag är sen? (valfritt)</label>
                  <textarea
                    id="latePolicy"
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
                {loadingTags ? (
                  <p className="text-sm text-secondary">Laddar taggar...</p>
                ) : userInterests.length === 0 ? (
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
          <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-white border-t border-border shadow-sticky-footer mt-auto pt-3 flex justify-end z-10">
            <Button type="submit" variant="primary" loading={isPending}>
              Skapa aktivitet
            </Button>
          </div>
        </form>
    </div>
  );
}
