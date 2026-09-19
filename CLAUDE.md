# CLAUDE.md

Guidance for Claude Code (or any AI coding agent) working in this repository. Read this before writing or editing any file here. The full spec lives in `PRD_Skyfall_Evasion.md` — this file is the operating manual for *how* to work on it, not a restatement of *what* it is.

---

## 1. Project Summary

**Skyfall Evasion** — a 2D top-down missile-survival arcade game ("Missiles!" clone) built for a Computer Graphics academic project (TE INFT, Sem V). Player pilots a plane that flies continuously forward while heat-seeking missiles spawn and pursue it.

**Hard constraint, non-negotiable:** HTML5 Canvas + vanilla JavaScript only. No game engine (no Phaser, PixiJS, Three.js, Matter.js), no physics library, no rendering framework. Every core mechanic — vector math, transforms, collision, particles — must be hand-implemented, because the implementation *is* the graded deliverable. If a task seems easier with a library, that ease is the wrong signal here — implement it by hand instead.

Read `PRD_Skyfall_Evasion.md` Section 1.1 before touching camera, transform, or homing code — those functions are individually graded in a viva and must stay identifiable and commented.

---

## 2. Tech Stack & Constraints

- Vanilla JavaScript, ES modules (`type="module"` in `index.html`, native `import`/`export`).
- No bundler required to run. A dev-only bundler/live-reload setup is fine if it doesn't change how `index.html` is opened for grading (must still work as a plain static file or simple local server).
- No TypeScript — but treat the JSDoc type comments in entity files as binding contracts; don't silently change an entity's shape without updating every consumer.
- No external assets required; if sprites/audio are added later, keep them optional and the game fully playable without them (vector-drawn shapes are the baseline).

---

## 3. Repository Layout

```
/skyfall-evasion
├── index.html
├── PRD_Skyfall_Evasion.md
├── CLAUDE.md
├── /src
│   ├── main.js
│   ├── state.js
│   ├── input.js
│   ├── camera.js
│   ├── config.js            # ALL tunable numbers live here — see Section 5 below
│   ├── entities/
│   │   ├── player.js
│   │   ├── missile.js
│   │   ├── obstacle.js
│   │   ├── pickup.js
│   │   └── particle.js
│   ├── systems/
│   │   ├── collision.js
│   │   ├── spawner.js
│   │   ├── countermeasures.js
│   │   └── parallax.js
│   ├── render/
│   │   ├── hud.js
│   │   └── sky.js
│   └── utils/
│       ├── vector.js
│       └── math.js
```

**Rule:** one concern per file. No file should exceed ~200 lines — if it's growing past that, it's doing two things and should split. This is a grading-legibility rule, not a style preference; don't consolidate files "for simplicity."

When adding a new file, put it in the directory matching its concern (`entities/` for a thing with position+update+draw, `systems/` for cross-entity logic, `render/` for pure drawing/HUD, `utils/` for stateless math). Don't invent a new top-level folder without checking the PRD's Section 4.1 first.

---

## 4. Non-Negotiable Architectural Rules

1. **All motion is `dt`-scaled.** Never write `x += speed` — always `x += speed * dt`. The RAF loop clamps `dt` to 0.05s max; don't remove that clamp.
2. **`alive: false` is the only removal mechanism.** Never `splice` an entity directly inside an update loop; mark it dead, and let the end-of-frame `array = array.filter(e => e.alive)` pass handle removal.
3. **World space vs screen space are never mixed.** Entities store world `(x, y)` only. Screen coordinates are computed transiently in `render()` via `camera.js`'s `worldToScreen()` — never stored on the entity.
4. **All tunable numbers live in `config.js`.** No magic numbers for speed, turn rate, spawn intervals, radii, cooldowns, etc. scattered across files. If you're tempted to hardcode a number for "just testing," put it in config anyway — see the tuning table in the PRD (Section 5) for defaults.
5. **No per-frame allocation in hot paths.** Don't do `particles.push({...})` unbounded — the particle system uses a pre-allocated, ring-buffer-style pool (PRD Section 4.7). Follow the same pattern if you extend it; don't regress to naive push/splice churn.
6. **Restart must fully reset state**, not reload the page. `state.js` owns a single `reset()` that zeroes/reinitializes every array and stat. If you add a new piece of state anywhere, add its reset here too — this is the single most common thing to forget.
7. **Every function implementing a CG concept from PRD Section 1.1 gets a one-line comment naming the concept.** E.g. `// Vector math: normalize direction to missile before scaling by turnRate`. This isn't optional decoration — it's part of the grading rubric.

---

## 5. Config-Driven Tuning

`config.js` should export a single `CONFIG` object mirroring the tuning table in `PRD_Skyfall_Evasion.md` Section 5 (player speed, fuel drain, spawn intervals, missile stats, flare/EMP charges, camera follow speed, sky lerp duration, etc.). When changing difficulty or feel, edit `CONFIG` — never inline a replacement number next to the old one "to compare." Difficulty curve changes should be a one-file diff.

---

## 6. Coding Conventions

- Prefer small, named pure functions in `utils/vector.js` and `utils/math.js` (`add`, `sub`, `scale`, `normalize`, `magnitude`, `dot`, `lerp`, `lerpAngle`, `distance`, `clamp`, `randRange`) over inlining the same math repeatedly. Reuse `lerpAngle` for anything angular — don't naively lerp raw angle values, since that breaks at the ±π wraparound.
- Entity `update(dt)` and `draw(ctx)` functions are the standard shape for anything in `entities/`. Keep `update` free of any `ctx` calls, and `draw` free of any state mutation — the split matters for both legibility and for isolating the "physics" from the "rendering" during a viva walkthrough.
- Collision checks live only in `systems/collision.js`. Don't inline a distance-based hit check inside an entity file — route it through the shared collision functions so there's one place to point to during grading.
- Comment the *why* for anything non-obvious (e.g., why `dt` is clamped, why particles use a pool, why flare confusion reuses the homing function with a different target) — these are exactly the design decisions worth defending in a report or viva.

---

## 7. What "Done" Looks Like

Before considering a feature complete, check it against the acceptance criteria table for that feature in `PRD_Skyfall_Evasion.md` Section 6 — every P0/P1/P2 item has a specific, testable bar, not just "it kind of works." Also check the relevant row(s) in the Section 8 risk/edge-case table and the Section 10 testing checklist before calling a milestone finished.

Do not mark a phase (Section 9 of the PRD) complete until its stated deliverable is actually playable end-to-end, not just individually functional in isolation.

---

## 8. Things to Never Do in This Repo

- Never pull in a game engine, physics library, or rendering framework, even "just for one small thing" (e.g. a tween library for the lerp, a vector math npm package). Implement it by hand — that's the point of the assignment.
- Never store screen-space coordinates on an entity.
- Never hardcode a tunable number outside `config.js`.
- Never remove or loosen the `dt` clamp in the main loop.
- Never reload the page to implement "restart" — always go through `state.reset()`.
- Never add a feature from PRD Section 2.2 (Non-Goals) — multiplayer, mobile touch controls, WebGL/3D, or procedural terrain generation beyond simple obstacle scattering — without an explicit, separate request; they're intentionally out of scope for the academic brief.

---

## 9. Useful Commands

Since there's no build step, running the game is just serving the directory statically, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `index.html` (or `http://localhost:PORT/`) in a browser. There is no test runner configured by default; manual testing follows the checklist in PRD Section 10. If you add automated tests (e.g. for `utils/vector.js` pure functions), keep them dependency-light and note the run command here.
