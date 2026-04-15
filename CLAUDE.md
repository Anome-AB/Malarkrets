@AGENTS.md
@TEAMS.md

## Conditional context

- When editing `.github/workflows/`, `Dockerfile`, `docker-compose*.yml`,
  `scripts/`, or `.env*` files → read `RELEASE.md` before making changes.
- When a change crosses a team boundary (see `TEAMS.md`) → flag it in your
  response so the user can coordinate.

## Design System

All UI decisions follow `DESIGN.md`. Read it before making any frontend changes.

Key rules:
- Use `<Card>` component (`@/components/ui/card`) for ALL content containers. Never write `bg-white border rounded-card p-6` inline.
- Use `<Card variant="danger">` for destructive action sections. Never `bg-red-50` inline.
- Use `<ConfirmDialog>` for confirmations. Never `window.confirm()`.
- Detail pages use responsive grid layouts that fill available space. Never `max-w-* mx-auto` on detail pages.
- Form pages use `max-w-3xl` with Card sections inside the form.
- Typography: Satoshi for headings (font-display), Instrument Sans for body text. Never use Inter as primary.
- Spacing follows 4px grid: xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64). Never use 12px spacing.
- Accent color `#c4956a` (copper) for badges and decorative highlights only. Use sparingly.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
