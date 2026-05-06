"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Tag } from "@/components/ui/tag";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
}

interface TagPickerProps {
  /** Användarens egna intressen - visas alltid som primära chips. */
  userInterests: InterestTag[];
  /** Alla taggar valda för aktiviteten (inkl. extras utanför userInterests). */
  selectedTags: number[];
  /** Toggla en tagg på/av. */
  onToggle: (tagId: number) => void;
  /** Visas medan userInterests laddas. */
  loading?: boolean;
  /** Egen ruta att visa när användaren inte har några intressen alls. */
  emptyMessage?: React.ReactNode;
}

/**
 * Aktivitetsformulärets tag-väljare. Visar användarens intressen som primära
 * chips, plus eventuella extras som lagts till från sök, plus ett sökfält
 * för att hitta fler taggar utanför de egna intressena.
 *
 * Beteende:
 * - Toggle på userInterest-chip: lägger till/tar bort tagg från aktiviteten,
 *   chipet blir kvar i listan oavsett.
 * - Toggle på extra-chip: tar bort taggen från aktiviteten, chipet försvinner
 *   (hitta tillbaka via sök).
 * - Sökresultat: filtrerar bort taggar som redan visas (userInterests + extras).
 */
export function TagPicker({
  userInterests,
  selectedTags,
  onToggle,
  loading = false,
  emptyMessage,
}: TagPickerProps) {
  const [allTags, setAllTags] = useState<InterestTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [allTagsLoaded, setAllTagsLoaded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Hämta alla taggar lat (när användaren öppnar sök eller redan har extras
  // i selectedTags som behöver renderas med namn). Samma cache hela komponentens
  // livslängd - taggar ändras inte ofta.
  useEffect(() => {
    const userInterestIds = new Set(userInterests.map((t) => t.id));
    const hasExtras = selectedTags.some((id) => !userInterestIds.has(id));
    if (!allTagsLoaded && (showSearch || hasExtras)) {
      setAllTagsLoaded(true);
      fetch("/api/interest-tags")
        .then((r) => (r.ok ? r.json() : { tags: [] }))
        .then((data) => setAllTags(data.tags ?? []))
        .catch(() => {
          // Tyst fail - användaren kan fortfarande använda sina egna intressen.
          setAllTagsLoaded(false);
        });
    }
  }, [showSearch, allTagsLoaded, selectedTags, userInterests]);

  // Stäng sök-dropdown vid klick utanför så formuläret känns "lugnt" igen.
  useEffect(() => {
    if (!showSearch) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearch]);

  const userInterestIds = useMemo(
    () => new Set(userInterests.map((t) => t.id)),
    [userInterests],
  );

  // Extras = aktivitetstaggar som inte finns bland användarens intressen.
  // Vi behöver allTags för att kunna rendera deras namn.
  const extraTags = useMemo(
    () =>
      selectedTags
        .filter((id) => !userInterestIds.has(id))
        .map((id) => allTags.find((t) => t.id === id))
        .filter((t): t is InterestTag => !!t),
    [selectedTags, userInterestIds, allTags],
  );

  // Sökresultat exkluderar redan visade taggar (userInterests + extras).
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const shownIds = new Set([
      ...userInterests.map((t) => t.id),
      ...extraTags.map((t) => t.id),
    ]);
    return allTags
      .filter((t) => !shownIds.has(t.id))
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, allTags, userInterests, extraTags]);

  if (loading) {
    return <p className="text-sm text-secondary">Laddar taggar...</p>;
  }

  const hasNoChips = userInterests.length === 0 && extraTags.length === 0;

  return (
    <div ref={wrapperRef} className="flex flex-col gap-3">
      {hasNoChips && emptyMessage ? (
        <div>{emptyMessage}</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {userInterests.map((tag) => (
            <Tag
              key={tag.id}
              label={tag.name}
              active={selectedTags.includes(tag.id)}
              onClick={() => onToggle(tag.id)}
            />
          ))}
          {extraTags.map((tag) => (
            <Tag
              key={tag.id}
              label={tag.name}
              active={true}
              onClick={() => onToggle(tag.id)}
            />
          ))}
        </div>
      )}

      {selectedTags.length === 0 && !hasNoChips && (
        <p className="text-xs text-dimmed">Välj minst en tagg</p>
      )}

      {!showSearch ? (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="self-start text-sm font-medium text-primary hover:underline"
        >
          + Lägg till annan tagg
        </button>
      ) : (
        <div className="relative">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Sök efter tagg..."
            className="w-full px-3 py-2 min-h-touch-target rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setShowSearch(false);
                setSearchQuery("");
              }
              if (e.key === "Enter" && searchResults.length > 0) {
                e.preventDefault();
                onToggle(searchResults[0].id);
                setSearchQuery("");
              }
            }}
          />
          {searchQuery.trim() && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-border rounded-control shadow-lg overflow-hidden">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-dimmed">
                  Inga matchande taggar
                </p>
              ) : (
                searchResults.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      onToggle(tag.id);
                      setSearchQuery("");
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-heading hover:bg-primary-light hover:text-primary transition-colors"
                  >
                    {tag.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
