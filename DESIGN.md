# Design System — Mälarkrets

## Product Context
- **What this is:** Community activity platform for people in Västerås to find and join local activities (hiking, photography, board games, cooking, etc.)
- **Who it's for:** Adults in Västerås who want to meet new people through shared interests
- **Space/industry:** Local community, events, social. Peers: Meetup, Luma, local Facebook groups
- **Project type:** Web app (responsive, mobile-first)

## Aesthetic Direction
- **Direction:** Scandinavian Warm Minimal
- **Decoration level:** Minimal — typography and spacing do the heavy lifting
- **Mood:** Clean and functional but with warmth. Nature around Mälaren as subtle inspiration, not clinical tech. A well-organized community board, not a SaaS dashboard.
- **Reference sites:** Meetup (2025 redesign), Luma, Circle.so

## Typography
- **Display/Hero:** Satoshi (700, 900) — Modern geometric sans with personality, distinctly not generic. Loaded via Fontshare.
- **Body:** Instrument Sans (400, 500, 600) — Warm, readable at small sizes, pairs well with Satoshi. Loaded via Fontshare.
- **UI/Labels:** Instrument Sans (500, 600) — same as body
- **Data/Tables:** Geist Mono (tabular-nums) — clean monospace for numbers in admin tables, participant counts, timestamps
- **Code:** Geist Mono
- **Loading:** Fontshare CDN for Satoshi + Instrument Sans. Geist Mono via Google Fonts. Inter as fallback only.
- **Scale:**

| Level | Size | Weight | Font | Usage |
|-------|------|--------|------|-------|
| H1 | 36px (2.25rem) | 700 | Satoshi | Page titles |
| H2 | 24px (1.5rem) | 700 | Satoshi | Card titles, section headers |
| H3 / Card title | 18px (1.125rem) | 700 | Satoshi | Card component title prop |
| Subtitle | 16px (1rem) | 600 | Satoshi | Sub-section headers |
| Body | 15px (0.9375rem) | 400 | Instrument Sans | Body text |
| Body strong | 15px | 500 | Instrument Sans | Emphasized body text |
| Small | 13px (0.8125rem) | 400 | Instrument Sans | Metadata (date, location) |
| Tiny | 11px (0.6875rem) | 400 | Instrument Sans | Help text |
| Mono | 13px | 400 | Geist Mono | Participant counts, timestamps in admin |

## Color
- **Approach:** Restrained — one accent plus warm neutrals. Color is rare and meaningful.

### Core palette
```
--color-primary: #3d6b5e        topbar, CTA, active tags, success
--color-primary-light: #e8f0ec  tag background, selected state
--color-primary-hover: #345c51  CTA hover
--color-bg: #f8f7f4             page background (warm off-white)
--color-surface: #ffffff        cards, panels
--color-text: #2d2d2d           primary text
--color-text-secondary: #666666 secondary text (AA compliant on white)
--color-text-dimmed: #999999    help text (only on text 18px+)
--color-border: #dddddd         card borders, dividers
```

### Accent + semantic
```
--color-accent: #c4956a         copper/wood — badges, decorative highlights
--color-accent-light: #f5ede4   accent background
--color-warning: #e07a3a        notifications, warnings
--color-error: #dc3545          errors, destructive actions
--color-success: #3d6b5e        confirmations (same as primary)
--color-info: #4a7c94           informational badges, secondary status
--color-info-light: #e6eff3     info background
--color-courage-bg: #faf8f2     "what to expect" box background
--color-courage-border: #e5dcc8 "what to expect" box border
```

### Dark mode strategy
- Invert surfaces: `--color-bg: #1a1a18`, `--color-surface: #2a2a28`
- Reduce saturation of primary and accent by 10-15%
- Text: `--color-text: #e8e8e6`, `--color-text-secondary: #a0a0a0`
- Borders: `--color-border: #3a3a38`
- Implementation: CSS custom properties with `prefers-color-scheme` media query. Not a priority for v1.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

Note: Previous md(12) was non-standard. All spacing now follows a clean 4px grid with power-of-2 progression.

## Layout
- **Approach:** Grid-disciplined — consistent responsive grids, no creative asymmetry
- **Grid:**
  - Mobile: 1 column
  - Tablet (md): 2 columns
  - Desktop (lg): 2-3 columns depending on page
- **Max content width:** None on detail pages (fill available space). `max-w-3xl` on form pages.
- **Border radius:**
  - Cards/panels: `rounded-[10px]` (10px)
  - Buttons/inputs: `rounded-[8px]` (8px)
  - Tags/badges: `rounded-full` (9999px)
  - Avatars: `rounded-full`

## Card Component
Import: `import { Card } from "@/components/ui/card";`

```tsx
<Card title="Rubrik">content</Card>           // default (white, gray border)
<Card title="Farligt" variant="danger">...</Card>  // red background, red border
```

Card renders: `rounded-[10px] p-6 border`. Variants:
- `default`: `bg-white border-[#dddddd]`
- `danger`: `bg-red-50 border-red-200`, title in `text-[#dc3545]`

ALWAYS use Card component. Never write `bg-white border border-[#dddddd] rounded-[10px] p-6` inline.

## Page Layouts

### Detail pages (profile, activity, admin, my activities)
```tsx
<div className="px-6 py-8">
  <h1 className="text-xl font-semibold text-[#2d2d2d] mb-6">Title</h1>
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <Card title="Section 1">...</Card>
    <Card title="Section 2">...</Card>
  </div>
</div>
```

Grid columns per page:
- **Profile:** `lg:grid-cols-2`
- **Activity detail:** `lg:grid-cols-3` with `lg:col-span-2` on main content
- **Admin:** `lg:grid-cols-1` (tables need full width)
- **My activities:** `lg:grid-cols-1` (activity grid inside each Card)

### Form pages (create/edit activity)
```tsx
<div className="max-w-3xl px-6 py-8">
  <h1>Title</h1>
  <form className="space-y-6">
    <Card title="Basic info">...</Card>
    <Card title="Restrictions">...</Card>
    <Button>Save</Button>
  </form>
  <Card variant="danger" title="Danger zone" className="mt-8">...</Card>
</div>
```

### Feed (homepage)
Activity cards in responsive grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5`

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** Enter: ease-out, Exit: ease-in, Move: ease-in-out
- **Duration:**
  - Micro: 100ms — hover states, focus rings, button press
  - Short: 200ms — card hover shadow, tag selection, input focus
  - Medium: 350ms — panel slide-in, modal open, accordion expand
  - Long: 500ms — page transitions (if implemented)
- **Rules:**
  - Always respect `prefers-reduced-motion` — disable all non-essential animation
  - No springy bounces, no staggered list animations
  - Card hover: `shadow-md` transition, not scale or translateY
  - Modal: fade overlay + scale-up content (from 0.95 to 1.0)

## Empty States
- Always show a message + CTA when a list is empty
- Use the Card component as container
- Icon or illustration (emoji is fine for v1) + short text + action button
- Example: "Du har inga aktiviteter ännu" + "Skapa din första aktivitet" button
- Tone: encouraging, not apologetic. "Inga aktiviteter hittades" not "Tyvärr finns det inga..."

## Loading States
- Use Skeleton component for content loading (gray pulsing rectangles matching content shape)
- Button loading: spinner icon replaces label text, button stays same width
- Full page: skeleton of the page layout (header + card outlines)
- Never show a blank page while loading

## Icons
- Emoji as primary icons for activity categories (v1)
- Lucide React for UI icons (already used for nav items)
- Keep icon usage minimal — text labels are primary, icons support

## Touch Targets
Minimum 44x44px on all interactive elements (WCAG 2.1 AAA). Use the semantic utility `min-h-touch-target` — never the arbitrary value `min-h-[44px]`. The `<Button>` component applies it automatically for `sm`/`md`/`lg` sizes.

**Compact exception:** `<Button size="compact">` opts out of the 44px minimum (~36px tall). Reserved for desktop-only dense surfaces: admin toolbars, modal footers, sticky action bars inside side panels. Never use `compact` on mobile-reachable surfaces or primary actions.

Sidebar nav: `py-3` (48px). Interest filters: `min-h-touch-target`.

## Shadows
Minimal. Cards: no shadow normally, `shadow-md` on hover. Modal: `shadow-xl`.

## Confirmation Dialogs
Always use `<ConfirmDialog>` component. Never `window.confirm()`. For complex dialogs (with text fields etc), build on `<Modal>` component.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-01 | Switch from Inter to Satoshi (display) + Instrument Sans (body) | Inter is overused in the category. Satoshi gives geometric precision with Scandinavian character. Instrument Sans is warm and readable. |
| 2026-04-01 | Add copper accent #c4956a | Breaks from pure green/white palette. Adds warmth — "wooden cabin by the lake" feeling. Used sparingly for badges and decorative highlights. |
| 2026-04-01 | Add info color #4a7c94 | Muted teal fits the palette better than pure blue. Used for informational badges. |
| 2026-04-01 | Fix spacing scale to pure 4px grid | Previous md(12) broke the pattern. New scale: 4, 8, 16, 24, 32, 48, 64. |
| 2026-04-01 | Add structured motion system | Previous "150ms ease" was too vague. New: micro/short/medium/long with specific easing per transition type. |
| 2026-04-01 | Add empty states, loading, dark mode sections | Design system had gaps that left implementation decisions ad-hoc. |
