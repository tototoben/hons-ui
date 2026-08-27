# House of Negotiated Selves

Ars Electronica 2026 installation: **House of Negotiated Selves**.

**Start here on the other machine:** **[HANDOFF.md](HANDOFF.md)** (orb + face parallax next). Full context: **[CONTEXT.md](CONTEXT.md)**.

## Project layout

| Path | What it is |
|------|------------|
| `orb-platform/` | **Active** installation app — stations, photobash wall, React + Three.js |
| `orb-ui/` | Earlier orb experiments (superseded by `orb-platform/` for new work) |
| `mirror/` | Flutter room simulation (local copy; may drift from team repo) |
| `work/eka-ars26-house/` | **Team monorepo** — `central/`, `mirror/`, `voice/` ([tototoben/eka-ars26-house](https://github.com/tototoben/eka-ars26-house)) |
| `scripts/` | Debra voice sample generation (ElevenLabs) |
| `PRODUCT.md` | Product / Impeccable context |
| `CONTEXT.md` | Machine handoff: journey, stack, next steps |

## Quick start (orb-platform — current focus)

```bash
cd orb-platform && npm install && npm run dev
```

Open **http://localhost:5176**. Next: webcam face parallax — see **[HANDOFF.md](HANDOFF.md)**.

## Room simulation (Flutter)

**Team source of truth:** `work/eka-ars26-house/mirror/` (clone via `work/README.md`).

```bash
cd work/eka-ars26-house/mirror   # preferred
# or legacy root copy:
cd mirror
flutter pub get
flutter run -d chrome   # or -d macos / -d windows
```

## Other scripts

```bash
cp .env.example .env   # add ELEVENLABS_API_KEY if needed
npm run samples:debra  # generate Debra voice samples
```

## Repo

https://github.com/martinorav-png/house-of-negotiated-selves
