# 🪔 Onam Arcade — Pookalam Rush, Vallam Kali Sprint & Thumbi Taal

Three browser-based Onam games built for **ONAM.exe** (IEEE SB VJCET), reached from a shared home menu.

**Play it:** open `index.html` in any browser, or visit the hosted link once this repo's GitHub Pages is enabled (see *Deploying* below).

---

## Three games, three Onam traditions

**🌼 Pookalam Rush** — bloom a flower carpet, colour by colour, across ten
rounds from Atham to Thiruvonam. See below for the full write-up.

**🚣 Vallam Kali Sprint** — a snake-boat river race. Switch between three
lanes to dodge rocks and logs and scoop up ceremonial lamps and flowers,
racing two rival boats down a river that gets faster the longer you survive.
It's a deliberately different genre (real-time reflexes vs. pattern-matching
against a clock) built around a second, equally central Onam tradition, so
the two games complement rather than duplicate each other.

**🪔 Thumbi Taal** — a one-touch rhythm game built around Thumbi Thullal,
the trance-like circle dance where the dancer sways to a steady beat. A
dancer orbits Maveli's lamp non-stop; tap the instant she sweeps through the
glowing golden zone at the top of the circle to land a *Perfect* or *Good*
hit, and the tempo quickens with every beat you keep. It's a third, distinct
genre again — pure timing/reflex against a rotating dial rather than pattern
matching or lane-dodging — so all three games stay genuinely different ways
to play with the festival rather than three skins on one mechanic.


## The Onam connection

Every year, Kerala counts down ten days — from Atham to Thiruvonam — building a
bigger, more elaborate **pookalam** (flower carpet) each morning to welcome King
Mahabali home. *Pookalam Rush* turns that ten-day ritual into the actual game
structure, not just a skin on top of a generic game:

- **The core mechanic *is* the tradition.** Each round is a ring of dim,
  half-open blossoms — not flat colour wedges. Every "segment" is its own
  two-layer flower (six back petals + six front petals + a stamen centre,
  each shaded with a radial gradient) fanned outward from the centre. You pick
  a flower colour and tap the matching dim blossom to bloom it into full,
  saturated colour with a little pop — the same colour-by-colour act of
  building a pookalam petal by petal, just sped up into a game.
- **Ten days, rising stakes.** The wheel grows a ring and a colour every couple of
  levels and the clock gets tighter, so Day 1 (Atham) is a gentle six-petal
  ring and Day 10 (**Thiruvonam**) is the biggest, most colourful pookalam in the
  game — mirroring how the real festival builds to its final, grandest carpet.
- **Maveli narrates.** A one-line message from the returning king opens every
  day, tying the score-chasing back to *why* you're building these patterns:
  he's coming home, and the village is getting ready for him.
- **The unexpected twist — Maveli's Feast.** Onam isn't only flowers; it's the
  **Onasadya** feast. Golden petals occasionally drift onto the screen mid-round;
  catching one pauses the pookalam and drops you into a six-second bonus round
  where sadya dishes (banana, mango, rice, coconut, curry, payasam) fall from
  the top for quick points — while a crow swooping in for a snack costs you
  points if you tap it. It's a second, distinct mini-mechanic built entirely
  from a second Onam tradition, layered into the main game rather than bolted
  on as a separate mode.

## Gameplay in one breath

**Pookalam Rush:** pick a colour → tap the matching pale segments → they
bloom → finish the pattern (or run out the clock, no penalty either way) →
next day begins. Five hearts total; a wrong-colour tap costs one. Consecutive
correct taps build a combo multiplier, so accuracy under time pressure is
rewarded more than just speed.

**Vallam Kali Sprint:** tap or swipe left/right (or use ← →) to switch lanes →
dodge rocks and logs → grab lamps and flowers for points → the river speeds up
the longer you last. Five hearts, a short invulnerability window after each
hit so one obstacle can't chain into three, and a distance counter that feeds
straight into your score.

**Thumbi Taal:** watch the dancer orbit the lamp → tap (or press Space) the
moment she crosses the golden arc at the top → dead-centre is a Perfect,
the edges are a Good, anything else costs a heart → land hits back-to-back
to build combo and speed up the dance. Five hearts, a growing combo bonus per
hit, and a tempo that ramps every five-hit streak so the pressure builds
smoothly rather than spiking.

All three are readable in one glance and playable within seconds — no
tutorial screen beyond the one paragraph on each game's intro card.

## Technical implementation

- **Stack:** `index.html` + `style.css` + `script.js` — plain vanilla
  JavaScript and CSS, no build step, no external JS dependencies, and no
  image/audio assets to ship (all visuals are generated at runtime). It runs
  identically opened straight from disk or hosted anywhere static.
- **Procedural pookalam, procedural flowers:** the wheel isn't a static image.
  Every level, the game computes ring/segment counts from the day index and,
  for each slot, draws a small layered blossom (two rotated rings of bezier
  petal paths plus a stamen dot, filled with a per-colour radial gradient that
  lightens toward the centre and darkens at the tip) positioned and rotated
  outward with simple polar-coordinate maths, with a touch of random jitter so
  the ring doesn't look mechanically identical. An invisible sector-shaped hit
  region sits under each flower so the whole slot — petal gaps included — stays
  tappable on mobile. So difficulty scaling and the flower rendering are both
  just data (rings, sectors, colour count, timer), not hand-drawn art.
- **Canvas-based boat race:** a `<canvas>` rendered at device-pixel-ratio
  resolution draws a scrolling river (gradient + animated wave lines), two
  decorative rival boats, and lane-based obstacles/collectibles — all drawn
  as emoji glyphs via `fillText`, avoiding any image assets. Difficulty is a
  handful of numbers (scroll speed, spawn interval) that ramp with distance
  survived, run inside a single `requestAnimationFrame` loop with delta-time
  updates so speed is frame-rate independent.
- **Feedback with zero assets:** correct/wrong/level-complete/catch/collision
  sounds are short oscillator blips generated live via the Web Audio API — no
  audio files to license or load, shared by both games.
- **Design system:** warm kasavu gold/cream and vermillion palette, `Baloo 2`
  for display type and `Mukta` for body text (both Google Fonts, OFL-licensed,
  loaded via `<link>` — see Credits). Reduced-motion and keyboard-focus styles
  are included for accessibility.
- **Persistent high scores:** each game's best score is saved via
  `localStorage` (with an in-memory fallback so a session still tracks
  correctly even if storage is blocked) and shown on the home menu.
- **Rhythm dial, zero assets:** Thumbi Taal has no canvas or SVG at all — a
  single absolutely-positioned emoji is rotated every animation frame via a
  plain CSS `transform: rotate()`, timed against a shrinking "ms per
  revolution" value. The target zone is a static `conic-gradient` ring, so
  hit-testing is just comparing the current angle to 0° — no collision
  library, no extra markup, same "difficulty is just a few numbers"
  philosophy as the other two games.
- **State machine:** a small `state` object drives Pookalam Rush's level
  setup → timer → segment interaction → level-end transition → optional bonus
  round → game end; a separate `boatState` object drives the boat race's
  spawn/update/render loop; a third `thumbiState` object drives the rhythm
  dial's angle/tempo/combo loop. A shared `showScreen()` / home-menu layer
  switches between the three games and their intro/end screens, with no
  external frameworks involved.

## Development approach

Built deliberately small in scope: one core mechanic (colour-matching a
procedurally generated pookalam against a timer), one thematically-linked bonus
mechanic (the feast mini-game), and no third system layered on top. The goal
was a complete, polished ten-round loop rather than an ambitious but
half-finished one, per the brief's own guidance that a simple, well-executed
idea scores better than complex mediocrity.

## Deploying / submitting

1. Push this folder to a **public** GitHub repository.
2. Enable **GitHub Pages** (Settings → Pages → deploy from the `main` branch,
   root folder) to get a playable web link — no build step needed, it's static.
3. Record a short screen capture of a full or partial playthrough.
4. Fill in the ONAM.exe submission form with the repo link, the Pages link (as
   the "playable online/web game" link), and the screen recording.

## Credits

- Fonts: [`Baloo 2`](https://fonts.google.com/specimen/Baloo+2) and
  [`Mukta`](https://fonts.google.com/specimen/Mukta) — Google Fonts, SIL Open
  Font License.
- All visuals are native emoji glyphs and code-drawn SVG shapes — no external
  image or audio assets.
- Game design, code, and writing: original work for this submission.

Onashamsakal! 🌼
