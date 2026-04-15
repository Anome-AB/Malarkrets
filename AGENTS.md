<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Team context

This repository is maintained by two Claude-backed teams. Before editing any
file, identify which team owns it — see `TEAMS.md`.

- **GreenLion** owns application code (`src/`, schema, UI, deps).
- **RedFox** owns release & deploy (`.github/workflows/`, `Dockerfile`,
  `docker-compose*.yml`, `scripts/`, `.env.prod.example`).

When editing RedFox-owned files, read `RELEASE.md` first. When a change
crosses the team boundary (see "Gränsytor" table in `TEAMS.md`), flag it
explicitly in your response so the user can coordinate with the other team.

Use the commit-prefix convention from `TEAMS.md` so history stays
self-documenting for both teams.
