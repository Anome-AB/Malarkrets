/**
 * Ett anonymiserat konto får sin e-postadress ersatt med en slumpad adress på
 * den här domänen (se `anonymizeUser` i `src/actions/admin.ts` och
 * `deleteAccount` i `src/actions/profile.ts`). Domänen är reserverad enligt
 * RFC 2606 och kan därför aldrig kollidera med en riktig adress.
 *
 * Anonymiseringen nollar också `emailVerified`, vilket gör markören viktig:
 * utan den ser ett raderat konto ut som ett vanligt obekräftat konto, och en
 * admin skulle kunna bekräfta det och därmed återuppliva det.
 */
export const ANONYMIZED_EMAIL_DOMAIN = "anonymized.invalid";

export function anonymizedEmail(): string {
  return `${crypto.randomUUID()}@${ANONYMIZED_EMAIL_DOMAIN}`;
}

export function isAnonymizedEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase().endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`) ?? false;
}
