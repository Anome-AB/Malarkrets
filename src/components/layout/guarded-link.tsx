"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { useUnsavedChanges } from "@/contexts/unsaved-changes";

type AnchorProps = Omit<ComponentProps<"a">, keyof LinkProps>;
type GuardedLinkProps = LinkProps &
  AnchorProps & {
    children?: ReactNode;
  };

/**
 * Drop-in-ersättare för next/link som kollar UnsavedChangesProvider
 * innan navigationen sker. Om dirty=true visar provider:n en bekräftelse-
 * dialog; om användaren väljer att stanna avbryts navigationen.
 *
 * Användargivna onClick körs först, sedan dirty-koll. Modifier-klick
 * (Ctrl/Cmd, mittenmus, Shift) släpps igenom oförändrade så de öppnar i
 * ny tab utan att trigga dirty-prompten - det är inte navigation från
 * den här sidan.
 */
export function GuardedLink({
  href,
  onClick,
  children,
  ...rest
}: GuardedLinkProps) {
  const router = useRouter();
  const { confirmLeave } = useUnsavedChanges();

  const handleClick = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;

    // Ctrl/Cmd-klick, mitten-mus, Shift osv. öppnar i ny tab/fönster.
    // Vi rör dem inte - användaren lämnar inte aktuella sidan.
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }

    e.preventDefault();
    const proceed = await confirmLeave();
    if (proceed) {
      // href kan vara string eller URL-objekt; router.push tar string.
      const target = typeof href === "string" ? href : href.toString();
      router.push(target);
    }
  };

  return (
    <Link href={href} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}
