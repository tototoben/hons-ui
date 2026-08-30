# House of Negotiated Selves — Full Context

Ars Electronica 2026 · Theme: **Future Begins – Negotiating Humanity**  
Festival starts: **9 September 2026**  
Package / repo: [`house-of-negotiated-selves`](https://github.com/martinorav-png/house-of-negotiated-selves)  
Branch to pull: **`main`**

This file is the handoff so another machine (or agent) can continue without chat history.

---

## Where we left off (Aug 2026)

### Active focus: `orb-platform` + face parallax (next)

Short continue note: **[`HANDOFF.md`](HANDOFF.md)**.

| Item | Status |
|------|--------|
| `orb-platform/` | Working R3F point-cloud room + orb, heartbeat ripple, mic motion, CRT + spatial question |
| Face parallax | **Spec + plan approved; not implemented** — see `docs/superpowers/specs/2026-08-03-webcam-face-parallax-design.md` and `docs/superpowers/plans/2026-08-03-webcam-face-parallax.md` |
| `assets/moodboard-inspo/` | Reference stills for the LiDAR / scan aesthetic |

```bash
cd orb-platform && npm install && npm run dev   # http://localhost:5176
```

**Next useful steps**

1. **Preferred:** implement face parallax from the plan in `docs/superpowers/plans/` (see `HANDOFF.md`)  
2. Physical journey scripts: `userjourney2.pdf` is local-only (gitignored, >100MB)

---

## Concept

Interactive solo installation about the line between human autonomy and machine representation, framed as a funhouse mirror. The visitor is reflected accurately at first, then the system gradually distorts, predicts, and misrepresents them.

**Core principle:** Debra (AI guide) is warm and sycophantic so visitors share freely. Extraction feels safe. The “forced” quality is revealed **retroactively** when the system keeps using what was given.

**Digital framing:** intake builds a **partner / companion**, not a “new self.”

- **Self / About You** = who the visitor is  
- **Desire** = what they want in a partner  
- **Matches / How You Love** = life vision, dealbreakers, intimate yes/no; personas may ask questions  
- **Generating / Forging / Reveal** = the **companion** is forged and shown  

---

## Physical layout (locked)

- Room: **8.6 × 4.8 × 2.8 m**, darkened, solo visitors  
- Corridor with **three right turns**, LED floor guides → **hexagonal final room** (mirrored walls + screen)  
- Exit curtained near entry (“end of the loop”)  
- Latex curtains + red/green lighting between stages  
- Physical aesthetic: **factory/clinical** (muted, matte, latex)  
- Production mirrors: **24″ portrait**

---

## Station journey (exhibit)

| Stage | Role |
|--------|------|
| Outside / Entry | Terms, queue, Debra intro (spatial + voice); on-screen Entry is short intro only |
| Station 1 — Self | Survey + ID photo; Debra coaches |
| Station 2 — Desire | Partner preferences; silhouette densifies |
| Station 3 — Matches | Life vision / dealbreakers / yes-no |
| Revealing chamber | Multi-screen avatar encounter (Unity); not in mock yet |
| Exit | Photocard + QR data receipt (EU AI Act) |

**Characters**

- **Debra:** Companion Guide. Voice: pre-recorded ElevenLabs v3.  
- **Final companion avatar:** live TTS in chamber; only live voice in the piece.  
- **Orchestrator:** hidden human (+ AI), can be glimpsed behind a curtain.

Canonical spoken entrance monologue: `scripts/debra-intro.txt` (on-screen Entry copy is separate).

---

## What’s in this repo

```
ARS-electronica/
├── CONTEXT.md              ← this file
├── PRODUCT.md              ← Impeccable product context
├── README.md
├── package.json            ← root scripts
├── orb-platform/           ← ACTIVE installation app (stations + photobash wall)
├── orb-ui/                 ← earlier orb experiments
├── mirror/                 ← Flutter room sim (local copy)
├── work/
│   ├── README.md           ← how to clone team repo
│   └── eka-ars26-house/    ← team monorepo (nested git; gitignored)
│       ├── central/        ← macOS orchestration server (TBD)
│       ├── mirror/         ← production Flutter mirror app
│       └── voice/          ← ESP-VOCAT firmware (TBD)
└── scripts/                ← Debra sample generation
```

**Not committed:** `.env`, `node_modules/`, `samples/*.mp3`, `*/dist/`, `userjourney.pdf` / `userjourney2.pdf` (too large for GitHub), Cursor/Claude local config, Stitch API keys.

---

## Voice / Debra samples

```bash
cp .env.example .env
# set ELEVENLABS_API_KEY=
npm run samples:debra
```

- Debra: **pre-recorded**, model `eleven_v3`  
- Canonical intro: `scripts/debra-intro.txt`  

---

## Team production repo

**Remote:** https://github.com/tototoben/eka-ars26-house  
**Local path:** `work/eka-ars26-house/` (nested clone; run `git clone … work/eka-ars26-house` on a fresh machine)

| Package | Status |
|---------|--------|
| `central/` | macOS room-state orchestrator — _to be set up_ |
| `mirror/` | Flutter Simulation + Kiosk — **active** |
| `voice/` | ESP-VOCAT firmware — _to be set up_ |

Root `mirror/` is a sibling copy for convenience; **`work/eka-ars26-house/mirror/` is the team source of truth** for production Pi work.

---

## Intended production stack (not built here yet)

- Hub: Mac Mini orchestration (`work/eka-ars26-house/central/`)  
- Clients: Raspberry Pi + displays, two-way mirrors (`work/eka-ars26-house/mirror/`)  
- Voice nodes: ESP-VoCat (`work/eka-ars26-house/voice/`)  
- Avatar pipeline: 2D A-pose → Meshy/Tripo → Unity  
- Lighting: Hue/LIFX + PIR  
- No live face biometrics stored / sent — webcam face pose for camera parallax (when implemented) is ephemeral, on-device only; EU AI Act disclosure still applies on QR receipt  

---

## Locked decisions

- No hologram → screen + Unity  
- Keyboard at interactive stations  
- Factory/clinical **physical** space  
- Digital direction currently **`orb-platform/`** (scan / point-cloud stations); Datebooth rose boutique is deprecated  
- Debra = Companion Guide  
- One live companion avatar per visitor + fallback library  
- Copy rule: **no em dashes** in UI copy  
- Content: **SFW**, gallery-safe  

## Still open

- Desire station vs How You Love naming / order vs journey PDF  
- Hexagon exit door vs retrace  
- Exact production display sizes  

---

## Team

Paula, Tõnis (Bender), Carina, Johannes Martin, Hendra, Sara, Anett, Martin (digital/technical), collaborator “Bob”. Weekly Mondays.

---

## Quick checklist on MacBook

1. `git clone` / `git pull` **main**  
2. Read **`HANDOFF.md`** (current next step: face parallax)  
3. `cd orb-platform && npm install && npm run dev` → http://localhost:5176  
4. Clone team repo: `git clone https://github.com/tototoben/eka-ars26-house.git work/eka-ars26-house`  
5. Optional: `work/eka-ars26-house/mirror` for Flutter sim (team source of truth)  

**Bottom line:** Continue **`orb-platform`** from the plan under `docs/superpowers/`. Datebooth (`datebooth-ui/`, `DESIGN.md`) and `mock-ui/` are removed.
