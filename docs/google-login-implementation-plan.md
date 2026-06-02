# Implementationsplan: Inloggning med Google

Status: **Förslag** (ej påbörjad). Spänner över båda team. Större strukturbeslut
synkas i PR enligt `TEAMS.md`.

> **Delar infrastruktur med Facebook-planen** (`docs/facebook-login-implementation-plan.md`).
> Den generiska `oauth_accounts`-tabellen och `password_hash`-nullable-migrationen
> är designade för båda. Se avsnitt 5 om sekvensering – bygger ni Facebook först
> behöver Google **ingen ny migration**.

## 1. Mål och omfattning

Låta användare logga in och registrera sig med sitt Google-konto, vid sidan av
e-post/lösenord (Credentials) och eventuell Facebook-inloggning. Google-inloggning ska:

- skapa ett nytt konto om e-posten inte finns,
- länka till ett befintligt konto om en verifierad e-post matchar,
- respektera ban-status och e-postverifiering på samma sätt som idag.

**Inte i scope (nu):** restricted/sensitive scopes (Gmail, Drive osv.) – enbart
`openid email profile`. Borttagning av lösenordsinloggning.

## 2. Nuläge

Identiskt med Facebook-planen (samma auth-grund):

- NextAuth v5 (`^5.0.0-beta.30`), **JWT-session utan databas-adapter** (`src/lib/auth.ts`).
- Enbart Credentials-provider med bcrypt; rullande 15-min-session med
  `passwordChangedAt`-invalidering.
- `users.password_hash` är **`NOT NULL`** (`src/db/schema.ts:147`) – krock med OAuth.
- Ingen `accounts`/OAuth-tabell finns.
- Route `app/api/auth/[...nextauth]/route.ts` fångar redan alla providers.

## 3. Arkitekturbeslut

Samma som Facebook-planen – upprepas här för fristående läsning.

| # | Beslut | Rekommendation | Motivering / alternativ |
|---|--------|----------------|-------------------------|
| A | Session-strategi | **Behåll JWT, ingen adapter** | Adapter krockar med custom user-schema + `passwordChangedAt`-invalidering. Provisionering/länkning i `signIn`-callback. |
| B | Identitetslagring | **Generisk `oauth_accounts`-tabell** | `(provider, provider_account_id) → user_id`. Delas med Facebook. `provider = "google"`, `provider_account_id` = Googles `sub`. |
| C | Kontolänkning | **Auto-länka på verifierad e-post** | Google levererar `email_verified`. Länka Google → befintligt konto när e-posten matchar och är verifierad; skapa nytt annars. Sätt `email_verified = true`. |
| D | `password_hash` | **Gör nullable** | Delas med Facebook-migrationen. Credentials-`authorize` avvisar lösenordsinloggning när hashen är null. |
| E | E-post / verifiering | **Kräv `email_verified = true`** | Google returnerar nästan alltid en verifierad e-post för `email`-scope. Saknas/everifierad → blockera (samma kontonyckel-krav som FB). |
| F | Ban | **Återanvänd logik i `signIn`** | `isBanned`-koll flyttas/dupliceras till `signIn`-callbacken (samma som FB). |

## 4. Dataflöde (Google sign-in)

```
Användare klickar "Logga in med Google"
        │  signIn("google")
        ▼
Google OAuth-dialog ──► callback /api/auth/callback/google
        ▼
NextAuth signIn-callback (delad logik med FB, provider="google"):
  1. email_verified från Google true?   nej → blockera (beslut E)
  2. Finns oauth_accounts-rad för (google, sub)?
        ja  → hämta user_id
        nej → finns users-rad med samma e-post?
                ja  → länka: skapa oauth_accounts-rad mot befintlig user
                nej → skapa users-rad (email_verified=true,
                       display_name=Google-namn, avatar_url=Google-bild,
                       password_hash=NULL) + oauth_accounts-rad
  3. user.isBanned?                      ja → blockera
  4. returnera true
        ▼
jwt-callback: token.id = vårt users.id (inte Googles sub)
        ▼
session-callback: oförändrad
```

## 5. Schema och sekvensering mot Facebook-planen

Google behöver **samma** schema-ändring som Facebook (avsnitt 5 i FB-planen):
`password_hash` nullable + `oauth_accounts`-tabell.

- **Om Facebook byggs först:** migrationen finns redan. Google kräver **ingen ny
  migration** – bara provider-config + delad `signIn`-logik som hanterar
  `provider="google"`.
- **Om Google byggs först eller fristående:** inkludera samma migration här
  (kopiera SQL:en från FB-planen).
- **Bygg inte två migrationer som båda skapar `oauth_accounts`.** Den som landar
  först äger migrationen; den andra återanvänder.

Designa `signIn`-callbacken provider-agnostisk från början så båda providers delar
kodvägen (skillnaden är bara `provider`-strängen och var `email_verified` läses).

## 6. GreenLion-aktiviteter (applikation + DB)

- [ ] **Migration:** endast om inte redan landad via Facebook-planen (avsnitt 5).
- [ ] **Schema:** `oauth_accounts` + `passwordHash` nullable (delas med FB).
- [ ] **Provider:** lägg `Google` i `providers` i `src/lib/auth.ts`
      (läser `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` automatiskt).
- [ ] **`signIn`-callback:** provider-agnostisk provisionering + länkning +
      `email_verified`-krav + ban-koll (dataflöde avsnitt 4). Återanvänd FB:s
      kodväg om den finns.
- [ ] **`jwt`-callback:** mappa OAuth-inloggning till vårt `users.id` (delas med FB).
- [ ] **Credentials-`authorize`:** avvisa när `password_hash` är null (delas med FB).
- [ ] **Login-UI:** "Logga in med Google"-knapp (`signIn("google")`). Knapp-stil
      enligt `DESIGN.md` (synlig bakgrund, ingen ghost). Placera bredvid ev.
      Facebook-knapp.
- [ ] **Nya Google-användare:** pre-fyll `display_name`/`avatar_url`, routa in i
      befintligt onboarding/profil-flöde.
- [ ] **`.env.example`:** lägg `AUTH_GOOGLE_ID=` + `AUTH_GOOGLE_SECRET=` med kommentar.
- [ ] **Tester:** authorize avvisar null-lösenord (om ej redan testat); signIn
      skapar/länkar Google-konto; ban blockeras; everifierad e-post blockeras.
- [ ] **PR:** flagga "kräver RedFox-wiring av `AUTH_GOOGLE_*`" (gränsyta).

## 7. RedFox-aktiviteter (Google Cloud, secrets, deploy)

- [ ] **OAuth 2.0 Client ID:** i Google Cloud Console → APIs & Services →
      Credentials → "OAuth client ID", typ **Web application**. Noteras: **Client
      ID** + **Client Secret**.
- [ ] **Authorized redirect URIs:**
      `https://vanligavasteras.se/api/auth/callback/google` (prod) + staging +
      `http://localhost:3000/...` (dev).
- [ ] **OAuth consent screen:** konfigurera app-namn, support-mejl,
      developer-kontakt, **Privacy Policy-URL**, ToS-URL, auktoriserad domän
      (`vanligavasteras.se`). Scopes: `openid email profile` (icke-känsliga).
- [ ] **Publish status:** flytta consent screen från **Testing** (bara
      explicit tillagda testanvändare, cap ~100) till **In production** för att
      släppa in alla. För icke-känsliga scopes krävs ingen tung Google-
      säkerhetsgranskning, men brand/domän-verifiering kan tillkomma (lättare än
      Metas App Review).
- [ ] **Secrets:** `AUTH_GOOGLE_SECRET` som GitHub Secret; `AUTH_GOOGLE_ID`
      committad default i `.env.prod.example`.
- [ ] **Compose:** wire:a `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` i
      `docker-compose.yml` (`environment:`). Runtime-secrets, **inte** build-arg.
- [ ] **`AUTH_URL`:** verifiera rätt domän så callback-URL:en löser (delas med FB).
- [ ] Återanvänd samma Google Cloud-projekt som Maps-nyckeln redan ligger i, om
      lämpligt – men separat OAuth-credential.

> **Ingen data-deletion-callback krävs** för Google (till skillnad från Meta).
> Vanlig konto-radering i appen räcker.

## 8. Gränsyta och sekvensering

Per `TEAMS.md`: ny runtime-env → GreenLion i `.env.example` + kod, RedFox wire:ar
compose + `.env.prod.example` + GitHub Secret.

Rekommenderad ordning (parallelliserbart):

1. **RedFox** skapar OAuth client + consent screen → ger GreenLion Client ID/Secret
   för dev. (Google har ingen lång review-ledtid för icke-känsliga scopes.)
2. **GreenLion** bygger provider + delad `signIn`-logik mot dev-credentials. Mergar.
3. **RedFox** wire:ar prod-secrets + redirect-URIs, publicerar consent screen.
4. Gemensam smoke-test i staging innan prod.

Om både Facebook och Google byggs: gör **OAuth-grunden** (tabell, `password_hash`
nullable, provider-agnostisk `signIn`/`jwt`-callback, Credentials-justering) **en
gång**, lägg sedan till varje provider som en tunn config + UI-knapp.

## 9. Edge cases

- `email_verified=false` från Google (ovanligt) → blockera (beslut E).
- E-post finns redan med lösenordskonto → länka; exponera inte att kontot finns.
- E-post finns redan länkat till Facebook → länka Google till **samma** users-rad
  (en `oauth_accounts`-rad per provider, samma `user_id`). Användaren får då
  e-post + FB + Google mot ett konto.
- Bannad användare loggar in via Google → blockera i `signIn`.
- Användare byter Google-namn/bild → uppdatera valfritt vid inloggning, matcha
  alltid på `provider_account_id` (`sub`), inte på e-post.
- `passwordChangedAt`-invalidering gäller inte Google-användare (ingen
  lösenordsändring) – ofarligt.

## 10. Testplan

- **Enhet:** `authorize` avvisar null-`password_hash` (delas); `signIn` för de fyra
  grenarna (ny user / länk / ban / everifierad e-post) med `provider="google"`.
- **Integration:** OAuth-callback mot Google-dev-credentials med testanvändare.
- **Manuell smoke (staging):** ny Google-användare, länkning till befintlig e-post,
  länkning till konto som redan har Facebook, bannad användare.

## 11. Insats och risk

- **GreenLion:** S–M. Om OAuth-grunden redan finns (via Facebook) är Google nästan
  bara en provider-rad + UI-knapp + tester. Annars M (samma som FB, inkl. migration).
- **RedFox:** S. Google Cloud OAuth-setup är snabb; **ingen lång App Review** för
  icke-känsliga scopes (stor skillnad mot Facebook). Consent-screen-publicering +
  privacy policy räcker.
- **Lägst risk av de två providerna** – Google saknar Metas review-flaskhals och
  data-deletion-callback-krav.
