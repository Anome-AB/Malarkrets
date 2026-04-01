# DESIGN.md — Mälarkrets designsystem

## Principer

1. **Containers som standard.** All innehåll på detaljsidor grupperas i Card-containers. Ingen lös text eller formulär utan container.
2. **Responsiv grid.** Containers placeras i en `grid` som fyller tillgänglig yta. På bred skärm flödar de sida vid sida, på smal skärm staplas de. Använd aldrig `max-w-*` + `mx-auto` för att centrera en smal kolumn mitt på en bred yta.
3. **Konsistens.** Alla containers har samma utseende via `<Card>` komponenten. Uppfinn inte styling per sida.

## Card-komponent

Importera: `import { Card } from "@/components/ui/card";`

```tsx
<Card title="Rubrik">innehåll</Card>           // standard (vit, grå ram)
<Card title="Farligt" variant="danger">...</Card>  // röd bakgrund, röd ram
```

Card renderar: `rounded-[10px] p-6 border`. Varianter:
- `default`: `bg-white border-[#dddddd]`
- `danger`: `bg-red-50 border-red-200`, rubrik i `text-[#dc3545]`

Använd ALLTID Card-komponenten. Skriv aldrig `bg-white border border-[#dddddd] rounded-[10px] p-6` direkt i sidkod.

## Sidlayouter

### Detaljsidor (profil, aktivitet, admin, mina aktiviteter)

```tsx
<div className="px-6 py-8">
  <h1 className="text-xl font-semibold text-[#2d2d2d] mb-6">Rubrik</h1>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card title="Sektion 1">...</Card>
    <Card title="Sektion 2">...</Card>
    <Card title="Sektion 3">...</Card>
    <Card variant="danger" title="Farligt område">...</Card>
  </div>
</div>
```

Grid-kolumner anpassas per sida:
- **Profil:** `lg:grid-cols-2` (personlig info + intressen sida vid sida)
- **Aktivitetsdetalj:** `lg:grid-cols-3` med `lg:col-span-2` på huvudinnehållet
- **Admin:** `lg:grid-cols-1` (tabeller behöver full bredd)
- **Mina aktiviteter:** `lg:grid-cols-1` (aktivitetsgrid inuti varje Card)

### Formulärsidor (skapa/redigera aktivitet)

Formulär har max-bredd (`max-w-3xl`) men containers inuti flödar vertikalt:

```tsx
<div className="max-w-3xl px-6 py-8">
  <h1>Rubrik</h1>
  <form className="space-y-6">
    <Card title="Grundläggande information">...</Card>
    <Card title="Begränsningar">...</Card>
    <Card title="Intressetaggar">...</Card>
    <Card title="Vad kan deltagare förvänta sig?">...</Card>
    <Button>Spara</Button>
  </form>
  <Card variant="danger" title="Farligt område" className="mt-8">...</Card>
</div>
```

### Feed (startsida)

Aktivitetskort i responsiv grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`

## Färger (CSS custom properties)

```
--color-primary: #3d6b5e        topbar, CTA, aktiva taggar
--color-primary-light: #e8f0ec  tagg-bakgrund, vald
--color-primary-hover: #345c51  CTA hover
--color-bg: #f8f7f4             sidbakgrund (varm off-white)
--color-surface: #ffffff        kort, paneler
--color-courage-bg: #faf8f2     "vad kan jag förvänta mig"-box
--color-courage-border: #e5dcc8 courage-box ram
--color-text: #2d2d2d           primär text
--color-text-secondary: #666666 sekundär text (AA-kompatibel)
--color-text-dimmed: #999999    hjälptext (bara på text 18px+)
--color-warning: #e07a3a        notiser, varningar
--color-error: #dc3545          fel, destruktiva actions
--color-success: #3d6b5e        bekräftelser (samma som primär)
--color-border: #dddddd         kort-ramar, dividers
```

## Typografi

Font: **Inter** (Google Fonts)

| Nivå | Storlek | Vikt | Användning |
|------|---------|------|------------|
| H1 | 24px | 700 | Sidrubriker |
| H2 | 18px | 600 | Korttitlar, sektionsrubriker |
| Card title | 16px | 600 | Card-komponentens title-prop |
| Body | 15px | 400 | Brödtext |
| Small | 13px | 400 | Metadata (datum, plats) |
| Tiny | 11px | 400 | Hjälptext |

## Spacing

4px bas: xs(4) sm(8) md(12) lg(16) xl(24) 2xl(32) 3xl(48)

## Radier

- Kort/paneler: `rounded-[10px]`
- Knappar: `rounded-[8px]`
- Taggar: `rounded-full`
- Avatarer: `rounded-full`

## Touch targets

Minst 44x44px på alla interaktiva element. Sidebar-nav: `py-3` (48px). Intressefilter: `min-h-[44px]`.

## Shadows

Minimala. Kort: ingen shadow normalt, `shadow-md` vid hover. Modal: `shadow-xl`.

## Transitions

150ms ease för hover/focus. 250ms ease-out för paneler. Respektera `prefers-reduced-motion`.

## Sidebar

- Full viewporthöjd via `lg:flex flex-col h-full` i container med `height: calc(100vh - 60px)`
- "Logga ut" fastnålad i botten via `mt-auto`
- Intressetaggar i `text-xs`, nav-items i `text-sm`
- "Alla" filter alltid överst i intresselistan

## Bekräftelsedialoger

Använd alltid `<ConfirmDialog>` komponenten. Aldrig `window.confirm()`. För mer komplexa dialoger (med textfält etc), bygg på `<Modal>` komponenten.

## Card-variant: danger

Används för destruktiva zoner (radera konto, ställa in aktivitet):
```tsx
<Card variant="danger" title="Farligt område">
  <p className="text-sm text-[#666666] mb-4">Beskrivning</p>
  <Button variant="danger">Destruktiv action</Button>
</Card>
```
