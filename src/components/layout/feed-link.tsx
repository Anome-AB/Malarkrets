"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "malarkrets:feed-filter";

/**
 * Persist the feed filter so "Utforska" and logo-links bring the user back
 * to the last view instead of resetting to "Mina intressen".
 *
 * Call once with the *current* feed search string when the feed mounts.
 * An empty string represents the default feed state (no filters, no
 * "Visa alla") and clears any previously stored state.
 */
export function saveFeedFilter(search: string) {
  if (typeof window === "undefined") return;
  try {
    if (search) {
      sessionStorage.setItem(STORAGE_KEY, search);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage can throw in privacy modes; non-fatal.
  }
}

function readFeedHref(): string {
  if (typeof window === "undefined") return "/";
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? `/?${stored}` : "/";
  } catch {
    return "/";
  }
}

interface FeedLinkProps {
  children: ReactNode;
  className?: string;
  /** Pass-through to the Link. */
  prefetch?: boolean;
}

/**
 * Link to the feed page (`/`) that restores the user's last filter state
 * from sessionStorage. Falls back to bare `/` if nothing is stored.
 *
 * Re-reads on pathname change so the href is fresh whenever the user is
 * about to navigate away from a non-feed page.
 */
export function FeedLink({ children, className, prefetch }: FeedLinkProps) {
  const pathname = usePathname();
  const [href, setHref] = useState<string>("/");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing to sessionStorage (an external system). Cannot derive during render because sessionStorage is not available during SSR.
    setHref(readFeedHref());
  }, [pathname]);

  return (
    <Link href={href} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}
