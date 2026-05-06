"use client";

import { useState, useEffect, useMemo } from "react";
import { Tag } from "@/components/ui/tag";

interface InterestTag {
  id: number;
  name: string;
  slug: string;
}

interface TagPickerProps {
  /** Användarens egna intressen - visas i "Mina intressen"-gruppen. */
  userInterests: InterestTag[];
  /** Alla taggar valda för aktiviteten (inkl. taggar utanför userInterests). */
  selectedTags: number[];
  /** Toggla en tagg på/av. */
  onToggle: (tagId: number) => void;
  /** Visas medan userInterests laddas. */
  loading?: boolean;
  /** Egen ruta att visa när användaren inte har några egna intressen. */
  emptyMessage?: React.ReactNode;
}

/**
 * Aktivitetsformulärets tag-väljare. Speglar profilvyns mönster: söksruta
 * högst upp + alla taggar som klickbara chips. Vi delar upp dem i två
 * grupper så användaren snabbt ser sina egna intressen, men kan välja
 * fritt även från andra taggar om aktiviteten passar in på fler.
 *
 * Beteende:
 * - Hämtar alla taggar direkt (samma endpoint som profilvyn).
 * - Söket filtrerar båda grupperna case-insensitive.
 * - Klick på chip togglar i selectedTags - identiskt för båda grupper.
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
  const [allTagsLoading, setAllTagsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/interest-tags")
      .then((r) => (r.ok ? r.json() : { tags: [] }))
      .then((data) => {
        if (!cancelled) setAllTags(data.tags ?? []);
      })
      .catch(() => {
        // Tyst fail - om endpoint är nere visas i alla fall användarens egna
        // intressen via userInterests-prop.
      })
      .finally(() => {
        if (!cancelled) setAllTagsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userInterestIds = useMemo(
    () => new Set(userInterests.map((t) => t.id)),
    [userInterests],
  );

  // "Övriga" = alla taggar minus användarens egna.
  const otherTags = useMemo(
    () => allTags.filter((t) => !userInterestIds.has(t.id)),
    [allTags, userInterestIds],
  );

  // Filtrera båda grupperna med samma sökterm.
  const matchesSearch = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (tag: InterestTag) => !q || tag.name.toLowerCase().includes(q);
  }, [searchQuery]);

  const filteredUserInterests = useMemo(
    () => userInterests.filter(matchesSearch),
    [userInterests, matchesSearch],
  );
  const filteredOtherTags = useMemo(
    () => otherTags.filter(matchesSearch),
    [otherTags, matchesSearch],
  );

  if (loading) {
    return <p className="text-sm text-secondary">Laddar taggar...</p>;
  }

  const noUserInterests = userInterests.length === 0;
  const hasNoMatches =
    searchQuery.trim() &&
    filteredUserInterests.length === 0 &&
    filteredOtherTags.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Sök intressen..."
        className="w-full px-3 py-2 min-h-touch-target rounded-control border border-border text-heading bg-white placeholder:text-dimmed focus:outline-none focus:ring-1 focus:border-primary focus:ring-primary text-sm"
      />

      {noUserInterests && emptyMessage ? (
        <div>{emptyMessage}</div>
      ) : (
        <div>
          <h3 className="text-sm font-medium text-heading mb-2">
            Mina intressen
          </h3>
          {filteredUserInterests.length === 0 ? (
            <p className="text-xs text-dimmed">
              {searchQuery.trim()
                ? "Inga av dina intressen matchar"
                : "Inga intressen valda"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {filteredUserInterests.map((tag) => (
                <Tag
                  key={tag.id}
                  label={tag.name}
                  active={selectedTags.includes(tag.id)}
                  onClick={() => onToggle(tag.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-heading mb-2">
          Övriga intressen
        </h3>
        {allTagsLoading ? (
          <p className="text-xs text-dimmed">Laddar...</p>
        ) : filteredOtherTags.length === 0 ? (
          <p className="text-xs text-dimmed">
            {searchQuery.trim()
              ? "Inga övriga intressen matchar"
              : "Inga övriga intressen tillgängliga"}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filteredOtherTags.map((tag) => (
              <Tag
                key={tag.id}
                label={tag.name}
                active={selectedTags.includes(tag.id)}
                onClick={() => onToggle(tag.id)}
              />
            ))}
          </div>
        )}
      </div>

      {hasNoMatches && (
        <p className="text-xs text-dimmed">
          Inga intressen matchar &quot;{searchQuery}&quot;
        </p>
      )}

      {selectedTags.length === 0 && (
        <p className="text-xs text-dimmed">Välj minst en tagg</p>
      )}
    </div>
  );
}
