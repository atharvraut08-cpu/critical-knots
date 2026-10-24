# Product Requirements Document
## "Critical Knots" — A 2D Top-Down Missile Survival Game
### TE INFT Computer Graphics Academic Project — v2.0

---

## 0. Document Control

| Field | Value |
|---|---|
| Project | Critical Knots |
| Course | Computer Graphics, TE INFT Sem V |
| Stack | HTML5 Canvas + Vanilla JavaScript (no engine, no physics lib) |
| Version | 2.0 (strengthened from v1.0 draft) |
| Status | Pre-development |

**What changed from v1.0:** added measurable acceptance criteria per feature, explicit non-functional requirements, a concrete file/module architecture, data schemas for every entity, a tuning table for difficulty curves, edge-case and failure-mode handling, a testing/demo checklist, and a risk register. v1.0 described *what* to build; this version pins down *exactly how done* looks and *how it fails gracefully*.

---

## 1. Project Overview & Academic Focus

**Critical Knots** is a browser-based 2D top-down arcade survival game — a "Missiles!" clone — in which the player pilots a plane that flies continuously forward while heat-seeking missiles spawn and pursue it. The player survives by steering, using countermeasures, and exploiting terrain to make missiles collide with obstacles or each other.

The project is built entirely with **HTML5 Canvas + Vanilla JavaScript**, with no game engine or physics library, so that every core computer graphics concept is implemented and demonstrable by hand. The gameplay is the vehicle; the graphics math is the deliverable, and the codebase must be legible enough to defend line-by-line in a viva.

### 1.1 CG Concepts Demonstrated (with rubric mapping)

| Concept | Where it appears | Suggested viva talking point |
|---|---|---|
| **Vector math** (magnitude, normalize, dot product) | Steering, homing pursuit, proximity checks | Show the normalize() function and explain why unit vectors matter for direction-only math |
| **Affine transformations** (translate, rotate, scale) | `ctx.translate` + `ctx.rotate` per entity | Draw the transform stack diagram: world → camera → screen |
| **Kinematic motion** (velocity, acceleration, angular velocity) | Plane movement, missile turn rate, boost | Explain why motion is dt-scaled, not frame-scaled |
| **Camera / viewport transform** (world → screen space) | Camera follow, all rendering | Show the `worldToScreen()` function in isolation |
| **Linear interpolation (lerp)** | Camera smoothing, sky color, particle fade | Explain lerp as the single most reused primitive in the codebase |
| **Euclidean distance & collision detection** | All plane/missile/obstacle/flare checks | Justify circle-circle over pixel-perfect for performance |
| **Parametric particle systems** | Smoke, explosions | Show the particle emitter as a pure function of `life/maxLife` |
| **Parallax scrolling** | Multi-layer background | Explain layerFactor and depth illusion without 3D |
| **Screen shake as matrix perturbation** | Explosion camera offset | Frame it as a random affine perturbation, damped over time |

**Grading-defense note:** every one of the nine rows above must have a corresponding, findable, commented function in the codebase — see Section 6.4 (Code Annotation Contract).

---

## 2. Goals, Non-Goals, and Success Criteria

### 2.1 Goals
- Deliver a fully playable, restart-able browser game with zero external dependencies.
- Make every CG concept from Section 1.1 independently identifiable in code.
- Ship a build that runs at a stable 60 FPS on a mid-range laptop with 100+ concurrent entities on screen.
- Produce a report/demo-ready artifact: commented code + a short write-up mapping code to theory.

### 2.2 Non-Goals (explicitly out of scope)
- Multiplayer, networking, or leaderboard persistence beyond `localStorage`.
- Mobile touch controls (desktop keyboard only — see Section 8, Risk 4, for the fallback stance).
- Any 3D rendering, WebGL, or external game engine (Phaser, PixiJS, etc.) — disallowed by the academic brief, not just unused.
- Procedural terrain generation beyond simple obstacle scattering (Section 4.8 defines the scope precisely).

### 2.3 Success Criteria (must all be true at submission)
1. A cold-loaded `index.html` reaches the title screen in under 1 second on a typical laptop, no build step required.
2. A full P0+P1+P2 run is playable start-to-crash-to-restart with no console errors.
3. Frame time stays under 16.6 ms (60 FPS) with ≤150 active particles + ≤20 missiles simultaneously (see Section 7.1 perf budget).
4. Every function implementing a Section 1.1 concept has a one-line comment identifying which concept it demonstrates (Section 6.4).
5. The game is fully restartable without a page reload (state reset, not `location.reload()`).

---

## 3. Core Gameplay Loop (PC Experience)

1. **Launch** — Player opens `index.html`; a full-bleed 16:9 canvas fills the window with a title screen ("Press Space to Fly").
2. **Take-off** — On start, the plane spawns at world-origin, moving forward at base cruise speed. Camera locks onto it.
3. **Steer** — `←`/`→` (or `A`/`D`) bank and turn the plane; the world scrolls via the camera transform.
4. **Threats emerge** — After a warm-up window (default 4s, tunable — Section 5), missiles spawn off-screen at intervals that shorten as survival time increases. "Heavy turners" and "straight rockets" mix in a ratio that shifts harder over time.
5. **Evade** — Missiles home in via vector-based pursuit. Player can:
   - Bait a missile into a static obstacle (mountain/asteroid).
   - Press `Space` to drop a flare (confuses nearby homing missiles within radius) or `E` for an EMP burst (destroys missiles in radius), each with limited charges and a cooldown.
   - Hold `Shift` for a temporary speed boost that burns fuel faster.
6. **Manage fuel** — A fuel gauge depletes continuously (faster while boosting); flying through fuel canisters refills it; empty fuel ends the run.
7. **Escalate** — Sky color lerps day → dusk → night as a visible signal of survival time and rising difficulty.
8. **Crash / Game Over** — Colliding with a missile, obstacle, or running dry ends the run with screen-shake + explosion particles, then a score screen (survival time, missiles destroyed, near-misses, fuel canisters collected).
9. **Retry** — A keypress resets all state in-place; a new run begins immediately.

### 3.1 Input Reference (must be documented on the title screen)

| Key | Action |
|---|---|
| ← / A | Bank left |
| → / D | Bank right |
| Shift (hold) | Speed boost (fuel drain ×2.5) |
| Space | Drop flare |
| E | Trigger EMP burst |
| R (on game-over screen only) | Restart |
| P | Pause / unpause |

---

## 4. Technical Architecture

### 4.1 File & Module Structure

No bundler is required, but the code must be split into ES modules for readability and grading:

```
/skyfall-evasion
├── index.html
├── /src
│   ├── main.js              # loop bootstrap, RAF loop, dt clamp
│   ├── state.js             # global game state object + reset()
│   ├── input.js              # keyboard listeners → input state map
│   ├── camera.js             # camera object, worldToScreen(), lerp follow, shake
│   ├── entities/
│   │   ├── player.js         # plane entity: update(), draw()
│   │   ├── missile.js        # both missile archetypes
│   │   ├── obstacle.js       # mountains/asteroids
│   │   ├── pickup.js         # fuel canisters
│   │   └── particle.js       # generic particle pool + emitters
│   ├── systems/
│   │   ├── collision.js      # all circle/AABB checks
│   │   ├── spawner.js        # missile/pickup/obstacle spawn logic + difficulty curve
│   │   ├── countermeasures.js# flare + EMP logic
│   │   └── parallax.js       # background layer rendering
│   ├── render/
│   │   ├── hud.js            # timer, fuel bar, charge counters, score screen
│   │   └── sky.js            # day/night color lerp
│   └── utils/
│       ├── vector.js         # add, sub, scale, normalize, magnitude, dot, lerp, lerpAngle
│       └── math.js           # clamp, randRange, distance
└── /assets                   # (optional) any sprite/audio assets, or none if all-vector-drawn
```

**Rule:** each file in `entities/` and `systems/` owns exactly one concern. No file may exceed ~200 lines; split further if it does. This is a grading-legibility requirement, not a performance one.

### 4.2 Rendering Loop

```js
function loop(timestamp) {
  const dt = clamp((timestamp - lastTime) / 1000, 0, 0.05); // capped delta time
  if (!state.paused) update(dt);
  render();
  lastTime = timestamp;
  requestAnimationFrame(loop);
}
```
All motion is scaled by `dt` so gameplay speed is frame-rate independent. The 0.05s clamp prevents "spiral of death" on tab-switch resume.

### 4.3 Entity Data Schemas

Explicit shapes (not enforced by TypeScript, but treated as contracts — document them as JSDoc):

```js
// player
{ x, y, heading, speed, baseSpeed, fuel, maxFuel, flares, maxFlares,
  emp, maxEmp, flareCooldown, empCooldown, radius, alive }

// missile
{ x, y, heading, speed, turnRate, type: 'homing' | 'rocket',
  radius, alive, confusedUntil /* flare effect timer */ }

// obstacle
{ x, y, shape: 'circle' | 'aabb', radius | (w, h), alive }

// pickup (fuel canister)
{ x, y, radius, amount, alive }

// particle
{ x, y, vx, vy, life, maxLife, size, color, kind: 'smoke' | 'explosion' }
```

Every array (`missiles[]`, `particles[]`, `obstacles[]`, `pickups[]`) is filtered each frame: `array = array.filter(e => e.alive)`. No entity is ever mutated to "look dead"; `alive = false` is the single source of truth for removal.

### 4.4 Camera & Coordinate System

- **World space**: entities store true `(x, y)` in an unbounded 2D world.
- **Camera**: `camera.x = lerp(camera.x, player.x, followSpeed * dt)` (same for y). Default `followSpeed = 4`.
- **Screen transform**:
  ```
  screenX = (worldX - camera.x) + canvas.width / 2 + shake.x
  screenY = (worldY - camera.y) + canvas.height / 2 + shake.y
  ```
- **Entity orientation**: `ctx.save() → ctx.translate(screenX, screenY) → ctx.rotate(heading) → draw at local origin → ctx.restore()`.
- **Culling**: entities more than `1.5 × max(canvas.width, canvas.height)` from the camera are skipped in `render()` (not deleted) to keep frame time bounded as the world grows.

### 4.5 Collision Detection

- **Circle-circle**: `dist(a,b) < radiusA + radiusB` for plane↔missile, missile↔missile, plane↔pickup, flare/EMP radius checks.
- **Circle-AABB**: mountains as elongated AABBs, asteroids as circles — implement one clamped-point circle-AABB test, reused for both.
- **Broad phase**: for MVP, brute-force O(n²) is acceptable given the entity cap in Section 7.1. A uniform spatial grid (cell size ≈ 2× largest radius) is the documented stretch optimization if profiling shows it's needed — do not build it speculatively.

### 4.6 Missile Homing (Vector Math)

```js
dx = player.x - missile.x, dy = player.y - missile.y
desiredAngle = atan2(dy, dx)
missile.heading = lerpAngle(missile.heading, desiredAngle, turnRate * dt)
missile.x += cos(missile.heading) * missile.speed * dt
missile.y += sin(missile.heading) * missile.speed * dt
```
`turnRate` differs per archetype (Section 5 has concrete tuning values). The unguided rocket has `turnRate = 0` — it locks heading at spawn and flies straight, demonstrating the contrast case for the homing algorithm in the viva.

**Flare interaction**: while `missile.confusedUntil > now`, `desiredAngle` is computed toward the flare's position instead of the player's, with the same lerp — reusing the identical homing function with a different target. This is a deliberate design choice worth calling out: one function, two behaviors, driven by target selection.

### 4.7 Particle System

Generic pool: `{x, y, vx, vy, life, maxLife, size, color, kind}`. Spawned per-frame from emitters (plane exhaust, missile trails, explosions). Alpha and size interpolated by `life / maxLife`; removed when `life <= 0`. Pool is pre-allocated to `MAX_PARTICLES = 300` and reused (object pooling) rather than churned via `push`/`splice`, to avoid GC pressure — call this out as a performance-aware design decision.

### 4.8 Parallax Background

2–3 layers, each a set of repeating tiled elements (stars, distant clouds/terrain), rendered at `-camera.x * layerFactor` (and y), where `layerFactor < 1` for distant layers. Layers are tiled procedurally (a repeating pattern, not hand-placed sprites) — scope this explicitly as "seeded pseudo-random tile placement, wrapped modulo tile size," not full procedural generation.

### 4.9 Difficulty & Spawn System

A single `spawner.js` module owns all spawn timing so the curve is tunable in one place (see Section 5 table). Missiles spawn on a ring just outside the camera's culling radius, at a random angle, heading roughly toward the player's current position at spawn time.

---

## 5. Tuning Table (Ship With These Defaults, Document Any Change)

| Parameter | Default | Notes |
|---|---|---|
| Player base cruise speed | 220 px/s | |
| Player turn rate | 2.2 rad/s | |
| Boost speed multiplier | 1.6× | |
| Boost fuel drain multiplier | 2.5× | |
| Max fuel | 100 | |
| Fuel drain rate (cruise) | 4/s | |
| Fuel canister refill amount | 30 | |
| Warm-up before first missile | 4 s | |
| Missile spawn interval (start) | 3.5 s | |
| Missile spawn interval (floor) | 0.8 s | reached at ~90s survival |
| Spawn interval decay | exponential, halves every 25s of survival | |
| Homing missile speed | 160 px/s | |
| Homing missile turn rate | 1.1 rad/s | |
| Rocket (unguided) speed | 260 px/s | |
| Rocket turn rate | 0 | |
| Missile archetype mix (start) | 80% homing / 20% rocket | |
| Missile archetype mix (@90s) | 50% / 50% | |
| Flare charges | 3, regen 1 per 20s | |
| Flare confuse radius | 180 px | |
| Flare confuse duration | 2.5 s | |
| EMP charges | 1, regen 1 per 45s | |
| EMP kill radius | 260 px | |
| Camera follow speed (lerp factor) | 4.0 | |
| Sky lerp full-cycle duration | 180 s (day→night) | |

Any of these is fair to retune during playtesting — but they must live in one exported `CONFIG` object (or `config.js`), not scattered magic numbers, so the difficulty curve is a one-file edit.

---

## 6. Feature Prioritization (with Acceptance Criteria)

### P0 — Must-Have Core (playable game)
| Feature | Acceptance criteria |
|---|---|
| Canvas setup, responsive, fixed internal render resolution | Resizing the browser window does not distort or letterbox incorrectly; internal resolution stays fixed and scales via CSS |
| RAF loop with delta-time | Game speed is visually identical at 30 FPS (throttled) and 60 FPS |
| Player plane entity | Steers left/right smoothly, heading visibly matches travel direction |
| Camera system | No jitter; follow lags smoothly behind sharp turns, never snaps |
| Basic homing missile | Missile visibly curves toward player, never instantly snaps heading |
| Collision detection | Plane vs missile and missile vs obstacle both trigger correctly at visually-matching radii (no invisible hitbox mismatch) |
| Game over + restart | Restart fully resets all arrays/state; no leftover missiles/particles from the previous run |
| Basic HUD | Survival timer visible and accurate to within 0.1s |

### P1 — Gameplay Additions
| Feature | Acceptance criteria |
|---|---|
| Flare + EMP | Charges deplete, regen on timer, UI reflects both accurately; EMP visibly clears missiles in radius on trigger |
| Static obstacles | At least one obstacle type usable to bait a missile kill, confirmed by playtesting |
| Fuel system | Fuel reaches 0 → game over triggers within one frame; canisters refill visibly and consistently |
| Two missile archetypes | Visually distinguishable (color/shape) and behaviorally distinct (turn rate difference obvious in play) |
| Boost mechanic | Speed change is immediate; fuel drain rate visibly steeper while held |
| Difficulty scaling | Spawn rate at 90s is measurably (not just theoretically) higher than at 10s |
| Score/stat tracking | Score screen shows time survived, missiles destroyed, near-misses — all non-zero-testable in a real run |

### P2 — Computer Graphics Bonus Features
| Feature | Acceptance criteria |
|---|---|
| Particle trails | Visible smoke trail persists and fades behind plane and missiles |
| Explosion bursts | Radial particle burst on every death event (plane or missile) |
| Parallax background | At least 2 layers moving at visibly different speeds relative to camera |
| Day/night lerp | Sky color visibly different at t=0 vs t=90s vs t=180s |
| Screen shake | Triggers on explosion, decays to zero within ~0.4s, does not desync the camera permanently |
| Minimap/radar (stretch) | Optional — only pursue after P0+P1+core P2 are stable |

---

## 7. Non-Functional Requirements

### 7.1 Performance Budget
- Target: 60 FPS sustained with ≤20 active missiles, ≤150 active particles, ≤10 obstacles/pickups on screen.
- Frame time ceiling: 16.6 ms; use `performance.now()` deltas during dev to self-profile, not just visual judgment.
- No per-frame allocations in hot paths (avoid `new Array()`/object-literal churn inside `update()`/`render()`); prefer the pre-allocated particle pool pattern from Section 4.7 for missiles/pickups too if profiling shows GC pauses.

### 7.2 Browser Compatibility
- Must run correctly in current Chrome, Firefox, and Edge with zero build step (no bundler required to run, though one may be used for dev convenience).
- No use of APIs requiring HTTPS-only contexts (fine for local `file://` or simple static serving).

### 7.3 Code Quality / Academic Legibility
- ES modules, one concern per file (Section 4.1).
- JSDoc-style comment block above every function implementing a Section 1.1 concept, naming the concept explicitly (Section 6.4 below).
- No global mutable state outside a single `state.js` module.

### 7.4 Accessibility (Scoped Minimum)
- All controls are keyboard-only by design (per Non-Goals); no additional a11y layer is in scope, but color choices for missile archetypes should remain distinguishable under common color-blindness (avoid red/green as the *only* differentiator — pair with shape).

---

## 8. Risks & Edge Cases

| # | Risk / edge case | Mitigation |
|---|---|---|
| 1 | Tab loses focus mid-game; `requestAnimationFrame` pauses, then resumes with a huge `dt` | dt clamp at 0.05s (Section 4.2) prevents teleport/tunneling on resume |
| 2 | Player holds boost with empty fuel | Boost silently disabled below a fuel floor (e.g. 5); no negative fuel state |
| 3 | Missile spawns directly on top of the player (edge case in ring-spawn math) | Enforce a minimum spawn distance from player position, not just "off-screen" |
| 4 | No touch/mobile support, but device is a tablet/phone | Detect lack of keyboard-capable viewport at load and show an explicit "desktop + keyboard required" message rather than a broken silent experience |
| 5 | Rapid restart spam (holding R) | Debounce restart to one trigger per game-over screen, ignore repeat keydowns until a new game-over occurs |
| 6 | Particle pool exhausted during a chaotic multi-explosion moment | Pool overwrite-oldest strategy (ring buffer) rather than skipping new particles, so visuals degrade gracefully instead of missing effects entirely |
| 7 | Flare confuses a missile that then flies into an obstacle it wouldn't have otherwise | This is a *feature*, not a bug — confirm scoring counts it as a valid kill for "missiles destroyed" |
| 8 | Two missiles collide with each other | Explicitly implement missile-vs-missile collision (Section 4.5) — both are destroyed, counts toward "missiles destroyed" for the player |

---

## 9. Development Milestones

### Phase 1 — Foundation (Core Loop & Camera)
Canvas setup, resize handling, fixed-timestep loop, player entity + input, camera transform, placeholder triangle with correct rotation.
**Deliverable:** flyable plane on an empty scrolling world, at stable frame rate.

### Phase 2 — Threats & Collision
Missile spawner (off-screen ring), homing + unguided archetypes, circle collision (plane vs missile), game over/restart, survival HUD.
**Deliverable:** a game that can be lost and restarted.

### Phase 3 — Gameplay Depth
Fuel + canisters, flare + EMP, obstacles + tactical collision, boost, difficulty scaling, stat tracking.
**Deliverable:** a game with meaningful player agency and a real difficulty curve.

### Phase 4 — Graphics Polish (Academic Showcase Layer)
Particle trails + explosions, parallax layers, day/night lerp, screen shake, HUD polish, score screen, CG-concept code comments finalized.
**Deliverable:** submission-ready build + report mapping code to Section 1.1.

### Phase 5 — Hardening & Demo Prep (new)
- Playtest for the edge cases in Section 8; fix any that reproduce.
- Profile against the Section 7.1 budget with the max entity counts; optimize only what the profiler flags.
- Write the short viva companion doc: for each Section 1.1 row, the file + line range + one sentence of explanation.
- Dry-run the demo: cold load → play to a crash → restart, timed, to make sure Success Criterion #1 holds.

---

## 10. Testing & Demo Checklist (New)

- [ ] Cold load reaches title screen < 1s
- [ ] Full run playable start → crash → score screen → restart, no console errors
- [ ] Frame rate holds ≥55 FPS with entity counts at Section 7.1 ceiling (use a debug entity-count HUD toggle during dev)
- [ ] All 9 concepts in Section 1.1 have a findable, commented implementation
- [ ] Restart resets every array and stat with no leakage from the previous run
- [ ] Each of the 8 risks/edge cases in Section 8 manually reproduced once and confirmed handled
- [ ] Difficulty curve confirmed to visibly escalate by comparing spawn rate at t=10s vs t=90s
- [ ] Both missile archetypes visually and behaviorally distinguishable in a screen recording
- [ ] Flare and EMP both confirmed functional with visible charge-count UI

---

## Appendix A — Core Math Reference

```js
// vector.js
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v, s) => ({ x: v.x * s, y: v.y * s });
const magnitude = (v) => Math.hypot(v.x, v.y);
const normalize = (v) => { const m = magnitude(v) || 1; return { x: v.x / m, y: v.y / m }; };
const dot = (a, b) => a.x * b.x + a.y * b.y;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + diff * t;
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
```

*Prepared for: TE INFT Computer Graphics coursework. Every major mathematical operation (rotation, lerp, homing vector, collision check) must carry a short in-code comment identifying the CG concept it demonstrates, so it can be pointed to directly during a viva/demo.*
