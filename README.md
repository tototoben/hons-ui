# House of Negotiated Selves

Ars Electronica 2026 installation: **House of Negotiated Selves**.

**Start here on the other machine:** **[HANDOFF.md](HANDOFF.md)** (stations I–III + photobash in `orb-platform`). Full context: **[CONTEXT.md](CONTEXT.md)**.

## Project layout

| Path | What it is |
|------|------------|
| `orb-platform/` | **Active** installation app — stations, photobash wall, React + Three.js |
| `orb-ui/` | Earlier orb experiments (superseded by `orb-platform/` for new work) |
| `mirror/` | Flutter room simulation (local copy; may drift from team repo) |
| `work/eka-ars26-house/` | **Team monorepo** — `central/`, `mirror/`, `voice/` ([tototoben/eka-ars26-house](https://github.com/tototoben/eka-ars26-house)) |
| `scripts/` | Debra monologue text and sample-generation helpers (speech is not wired in `orb-platform`) |
| `PRODUCT.md` | Product / Impeccable context |
| `CONTEXT.md` | Machine handoff: journey, stack, next steps |

## Quick start (orb-platform — current focus)

```bash
cd orb-platform && npm install && npm run dev
```

Open **http://localhost:5176**. Next: festival kiosk bring-up (WAN-off check) — see **[HANDOFF.md](HANDOFF.md)**.

## Room simulation (Flutter)

**Team source of truth:** `work/eka-ars26-house/mirror/` (clone via `work/README.md`).

```bash
cd work/eka-ars26-house/mirror   # preferred
# or legacy root copy:
cd mirror
flutter pub get
flutter run -d chrome   # or -d macos / -d windows
```

## Repo

https://github.com/martinorav-png/house-of-negotiated-selves
