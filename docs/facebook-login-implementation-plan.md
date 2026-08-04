# Implementationsplan: Inloggning med Facebook

Status: **Förslag** (ej påbörjad). Spänner över båda team. Större strukturbeslut
synkas i PR enligt `TEAMS.md`.

## 1. Mål och omfattning

Låta användare logga in och registrera sig med sitt Facebook-konto, vid sidan av
den befintliga e-post/lösenord-inloggningen (Credentials). Facebook-inloggning ska:

- skapa ett nytt konto om e-posten inte finns,
- länka till ett befintligt konto om en verifierad e-post matchar,
- respektera ban-status och e-postverifiering på samma sätt som idag.

**Inte i scope (nu):** andra OAuth-providers (Google m.fl.) – men schemat designas
så de kan läggas till utan ny migration. Borttagning av lösenordsinloggning.

## 2. Nuläge

- NextAuth v5 (`^5.0.0-beta.30`), **JWT-session utan databas-adapter**
  (`src/lib/auth.ts`).
- Enbart Credentials-provider med bcrypt. Rullande 15-min-session med
  `passwordChangedAt`-baserad invalidering i `jwt`-callbacken.
- `users.password_hash` är **`NOT NULL`** (`src/db/schema.ts:147`) – hård krock
  med OAuth-användare som saknar lösenord.
- Ingen `accounts`/OAuth-tabell finns.
- Profilfält (`first_name`, `last_name`, `birth_date`, `display_name`,
  `avatar_url`) är nullable; `gender` har default. Registrering kräver bara
  e-post + lösenord, resten fylls i efteråt (profil + intresse-onboarding).
- Route `app/api/auth/[...nextauth]/route.ts` fångar redan alla providers
  (callback-URL behöver ingen ny route).

## 3. Arkitekturbeslut

| # | Beslut | Rekommendation | Motivering / alternativ |
|---|--------|----------------|-------------------------|
| A | Session-strategi | **Behåll JWT, ingen adapter** | DrizzleAdapter skulle krocka med ert custom user-schema och `passwordChangedAt`-invalidering. Vi gör provisionering/länkning manuellt i en `signIn`-callback. |
| B | Identitetslagring | **Ny generisk tabell `oauth_accounts`** | `(provider, provider_account_id) → user_id`. Framtidssäker för fler providers utan ny migration. Lättare MVP-alternativ: en `facebook_id`-kolumn på `users`, men kräver ny migration vid nästa provider. |
| C | Kontolänkning | **Auto-länka på verifierad e-post** | Facebook-mejl räknas som verifierat av Meta. Länka FB → befintligt konto när e-posten matchar; skapa nytt annars. Sätt `email_verified = true` för FB-användare. |
| D | `password_hash` | **Gör nullable** | OAuth-användare har inget lösenord. Credentials-`authorize` måste avvisa lösenordsinloggning när hashen är null ("Det här kontot använder Facebook-inloggning"). |
| E | Saknad e-post från FB | **Blockera med tydligt fel** | `users.email` är `NOT NULL UNIQUE` och är kontonyckeln. Begär `email`-scope; nekar användaren, visa fel och avbryt inloggningen. |
| F | Ban / verifiering | **Återanvänd befintlig logik i `signIn`** | `isBanned`-kollen ligger idag i Credentials-`authorize`. Den måste flytta/dupliceras till `signIn`-callbacken, annars kan bannad användare logga in via FB. |

## 4. Dataflöde (Facebook sign-in)

```
Användare klickar "Logga in med Facebook"
        │  signIn("facebook")
        ▼
Facebook OAuth-dialog ──► callback /api/auth/callback/facebook
        ▼
NextAuth signIn-callback (NY logik):
  1. Har profilen e-post?            nej → blockera (beslut E)
  2. Finns oauth_accounts-rad för (facebook, sub)?
        ja  → hämta user_id
        nej → finns users-rad med samma e-post?
                ja  → länka: skapa oauth_accounts-rad mot befintlig user
                nej → skapa users-rad (email_verified=true,
                       display_name=FB-namn, avatar_url=FB-bild,
                       password_hash=NULL) + oauth_accounts-rad
  3. user.isBanned?                  ja → blockera
  4. returnera true
        ▼
jwt-callback: sätt token.id = vårt users.id (inte FB:s sub)
        ▼
session-callback: oförändrad (mappar token.id → session.user.id)
```

## 5. Schema-ändringar (en migration)

```sql
-- 1. Tillåt OAuth-användare utan lösenord
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- 2. Generisk OAuth-koppling (beslut B)
CREATE TABLE "oauth_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,             -- "facebook"
  "provider_account_id" text NOT NULL,  -- FB:s subject-id
  "created_at" timestamp DEFAULT now(),
  UNIQUE ("provider", "provider_account_id")
);
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts"("user_id");
```

Drizzle-schema (`schema.ts`) uppdateras motsvarande + snapshot/journal enligt
`docs/DATA_MIGRATIONS.md`. `seed.ts` rörs inte (FB-konton seedas inte).

## 6. GreenLion-aktiviteter (applikation + DB)

- [ ] **Migration:** `password_hash` nullable + `oauth_accounts`-tabell (avsnitt 5).
- [ ] **Schema:** lägg `oauthAccounts` i `schema.ts`, gör `passwordHash` nullable i typen.
- [ ] **Provider:** lägg `Facebook` i `providers` i `src/lib/auth.ts`
      (läser `AUTH_FACEBOOK_ID` / `AUTH_FACEBOOK_SECRET` automatiskt).
- [ ] **`signIn`-callback:** provisionering + länkning + e-postkrav + ban-koll
      (dataflödet i avsnitt 4).
- [ ] **`jwt`-callback:** mappa OAuth-inloggning till vårt `users.id`.
- [ ] **Credentials-`authorize`:** avvisa när `password_hash` är null med tydligt
      meddelande.
- [ ] **Login-UI:** "Logga in med Facebook"-knapp (`signIn("facebook")`).
      Synlig bakgrund/knapp-stil enligt `DESIGN.md` (ingen ghost-knapp).
- [ ] **Nya FB-användare:** pre-fyll `display_name`/`avatar_url` från FB, routa in
      i befintligt onboarding/profil-flöde för resterande fält.
- [ ] **Data deletion:** endpoint som tar emot Facebooks signed data-deletion-request
      och triggar befintlig `anonymizeUser`/`deleteAccount`-logik (MVP-alternativ:
      en instruktions-URL som pekar på konto-radering i appen).
- [ ] **`.env.example`:** lägg `AUTH_FACEBOOK_ID=` + `AUTH_FACEBOOK_SECRET=` med kommentar.
- [ ] **Tester:** authorize avvisar null-lösenord; signIn skapar/länkar konto;
      ban blockeras; saknad e-post blockeras.
- [ ] **PR:** flagga "kräver RedFox-wiring av `AUTH_FACEBOOK_*`" (gränsyta).

## 7. RedFox-aktiviteter (Meta-app, secrets, deploy)

- [ ] **Meta-app:** skapa "Consumer"-app i developers.facebook.com, lägg till
      produkten **Facebook Login**. Notera **App ID** + **App Secret**.
- [ ] **OAuth Redirect URIs** i Meta-dashboarden:
      `https://vanligavasteras.se/api/auth/callback/facebook` (prod) +
      staging + `http://localhost:3000/...` (dev).
- [ ] **Secrets:** `AUTH_FACEBOOK_SECRET` som GitHub Secret;
      `AUTH_FACEBOOK_ID` committad default i `.env.prod.example`.
- [ ] **Compose:** wire:a `AUTH_FACEBOOK_ID` + `AUTH_FACEBOOK_SECRET` i
      `docker-compose.yml` (`environment:`). Runtime-secrets, **inte** build-arg
      (server-side, inte `NEXT_PUBLIC_*`).
- [ ] **`AUTH_URL`:** verifiera att den pekar på rätt domän så callback-URL:en löser.
- [ ] **Caddy/HTTPS:** bekräfta att callback fungerar genom reverse-proxyn.
- [ ] **Go-Live-krav i Meta:** Privacy Policy-URL, Data Deletion-callback/URL,
      app-ikon, kategori.
- [ ] **App Review + Business Verification** för `email`-permission (lång ledtid –
      **starta tidigt**). I dev-läge kan bara app-roller logga in.

## 8. Gränsyta och sekvensering

Per `TEAMS.md`-tabellen: ny env-variabel som behövs i runtime → GreenLion lägger i
`.env.example` + kod, RedFox wire:ar compose + `.env.prod.example` + GitHub Secret.

Rekommenderad ordning (parallelliserbart):

1. **RedFox** skapar Meta-app + dev-credentials → ger GreenLion App ID/Secret för dev.
   Startar App Review-processen för `email` (lång ledtid).
2. **GreenLion** bygger mot dev-appen (test-användare/app-roller) – migration,
   provider, `signIn`-callback, UI, tester. Mergar till master.
3. **RedFox** wire:ar prod-secrets + redirect-URIs, tar appen Live efter godkänd
   App Review.
4. Gemensam smoke-test i staging innan prod.

## 9. Edge cases

- FB-konto utan e-post → blockera (beslut E).
- E-post finns redan med lösenordskonto → länka (beslut C), exponera inte att
  kontot finns (undvik enumeration).
- Bannad användare loggar in via FB → blockera i `signIn`.
- Användare avregistrerar appen i Facebook → data-deletion-callback ska hantera det.
- FB returnerar ändrad e-post vid senare inloggning → matcha i första hand på
  `oauth_accounts.provider_account_id` (FB:s `sub`), inte på e-post.
- Befintlig session-invalidering (`passwordChangedAt`) gäller inte FB-användare
  (de har ingen lösenordsändring) – ofarligt, claimen är bara null.

## 10. Testplan

- **Enhet:** `authorize` avvisar null-`password_hash`; `signIn`-callback för de fyra
  grenarna (ny user / länk / ban / saknad e-post).
- **Integration:** OAuth-callback mot Metas dev-app med test-användare.
- **Manuell smoke (staging):** ny FB-användare, befintlig e-post-länkning, bannad
  användare, nekad e-post.

## 11. Insats och risk

- **GreenLion:** M (migration + callback-logik + UI + tester). Callback-logiken är
  kärnan; resten är litet.
- **RedFox:** S kod/compose, men **App Review/Business Verification är lång ledtid**
  (dagar–veckor) och är kritiska vägen till Live. Starta först.
- **Största risken:** Meta App Review för `email`. Tills den är klar fungerar
  inloggning bara för app-roller. Allt annat är rakt fram.
