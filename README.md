# Critical Knots

> **A 2D Top-Down Newtonian Aerial Combat & Evasion Simulation**  
> *Developed for the TE INFT Computer Graphics Course (Semester V)*

---

## 1. Project Title & Abstract

**Critical Knots** is an arcade-style, top-down 2D aerial combat and missile evasion simulation designed and engineered for the Third-Year Information Technology (TE INFT) Computer Graphics curriculum.

Built from the ground up using **native HTML5 Canvas (`2D Context`) and vanilla JavaScript (ES6 modules)**, the project operates under a strict, non-negotiable architectural constraint: **zero external game engines** (no Phaser, Pixi.js, Three.js, or Matter.js) and **zero physics/math libraries**. Every fundamental graphic transformation, kinematic equation, vector calculation, collision algorithm, and particle emitter is hand-implemented. The game serves as an interactive demonstration of fundamental computer graphics mathematics, physics-based numerical integration, and classic autonomous agent steering behaviors.

---

## 2. Core Features & Graphics Math

### 🚀 Newtonian Aerodynamics & Flight Mechanics
- **Decoupled Kinematics & Aerodynamic Drift:** Unlike traditional arcade games that lock aircraft velocity directly to their facing angle, *Critical Knots* decouples the nose heading ($\theta$) from the linear velocity vector ($\vec{v} = [v_x, v_y]^T$).
- **Engine Thrust Vectoring:** Forward thrust accelerates the aircraft strictly along its longitudinal nose axis:
  $$\vec{a}_{\text{thrust}} = \begin{bmatrix} \cos\theta \\ \sin\theta \end{bmatrix} \cdot T$$
- **Lateral Grip & Drift Compensation:** Aircraft wings and vertical stabilizers exert an aerodynamic restoring force that continuously dampens lateral sideslip ($v_{\text{lateral}}$):
  $$v_{\text{lateral}} = \vec{v} \cdot \vec{u}_{\text{lateral}} = -v_x \sin\theta + v_y \cos\theta$$
  $$\vec{a}_{\text{restore}} = -k_{\text{grip}} \cdot v_{\text{lateral}} \cdot \vec{u}_{\text{lateral}}$$
- **Quadratic Aerodynamic Drag:** True fluid resistance is modeled quadratically, causing aircraft and projectiles to naturally converge onto terminal velocities without artificial speed clamps:
  $$\vec{F}_d = -C_d \cdot \|\vec{v}\|^2 \cdot \frac{\vec{v}}{\|\vec{v}\|}$$
- **Induced Drag:** Executing tight, high-G bank turns bleeds kinetic airspeed dynamically to reward thoughtful energy management.
- **Double-Tap Barrel Roll / Lateral Dash:** Double-tapping directional keys inputs an instantaneous lateral vector impulse to evade incoming missile trajectories.

### 📐 Custom Vector Mathematics & Targeting
- **Dot Product Radar / Boresight Target Lock:** The missile targeting system utilizes the vector dot product to determine if an enemy aircraft falls within the player's narrow $15^\circ$ forward radar cone:
  $$\cos\phi = \frac{\vec{u}_{\text{nose}} \cdot (\vec{p}_{\text{target}} - \vec{p}_{\text{player}})}{\|\vec{p}_{\text{target}} - \vec{p}_{\text{player}}\|} \ge \cos(15^\circ) \approx 0.9659$$
  Maintaining this geometric alignment continuously for $0.5\text{s}$ achieves a missile hard-lock.
- **Affine Coordinate Transformations:** All rendered entities (fighters, missiles, flares, smoke puffs, and debris) leverage nested canvas matrix state stacks (`save()`, `translate()`, `rotate()`, `restore()`) for local-to-world and world-to-screen coordinate mapping.
- **Altitude Drop Shadows:** Simulated lighting altitude projections render scaled, offset drop-shadow silhouettes prior to drawing airframes, producing pseudo-3D flight elevation cues.
- **Dynamic Camera Projection:** Smooth Lerp tracking incorporates velocity lead lookahead and procedural camera shake triggered by explosions and near-miss supersonic shockwaves.

### 🎯 AI Guidance & Autonomous Steering Behaviors
- **Proportional Navigation (PN) Missile Guidance:** Heat-seeking missiles employ real-world guidance laws where the commanded turning rate is proportional to the line-of-sight (LOS) angular velocity:
  $$\dot{\theta} = N \cdot \dot{\lambda} \quad (N = 3.5)$$
- **Dual Boost & Coast Missile Kinematics:** Missiles burn rocket fuel under high acceleration for $3.0\text{s}$ before entering an unpowered coast phase where aerodynamic drag degrades airspeed and control-surface turn authority.
- **Adversary Pursuit Curves:** AI fighter jets dynamically alternate between:
  - **Lead Pursuit:** Calculating predictive intercept positions when engaging targets at long range ($> 350\text{px}$).
  - **Lag Pursuit:** Steering behind the player's tail vector at close range ($\le 350\text{px}$) to prevent high-speed overshoots.
- **Flocking & Separation:** Coordinated adversary AI calculates spatial separation vectors ($150\text{px}$ threshold) to prevent mid-air collisions among wingmen.
- **Countermeasure Spoofing:** Decoy flares simulate realistic thermal signatures and decay timers, creating probabilistic infrared seeker attraction cones that break missile target locks.

---

## 3. Game Modes

### 1. Survival Mode (Phased Escalation)
The definitive arcade endurance challenge. Survive as long as possible against escalating waves of incoming heat-seeking missiles:
- **Phase 1 (0–30s):** Standard tracking missiles allowing the pilot to settle into the flight envelope.
- **Phase 2 (30–60s):** High-speed interceptors and heavy warhead missiles with aggressive tracking gains.
- **Phase 3 (60s+):** Overwhelming multi-missile salvos requiring precise drift banking, obstacle threading, and timely countermeasure deployment.
- **Resource Management:** Collect fuel canisters spawned across the open airspace to stay airborne while managing a finite flare supply.

### 2. Dogfight Mode (1v2 Tactical Air Combat)
An authentic tactical air engagement pitting the player against two coordinated AI fighter jets (**BOGEY-1** and **BOGEY-2**):
- **Finite Payloads:** Both player and adversaries have limited armaments—500 rounds of 20mm cannon ammunition, 6 heat-seeking missiles, and defensive flare charges.
- **Radar Warning Receiver (RWR):** Auditory and visual warning indicators sound when an adversary jet locks onto your aircraft from astern.
- **Tactical Win/Loss Conditions:** Down both enemy fighters to secure airspace superiority, or suffer defeat if shot down.

### 3. Flight School (Tactical Flight Academy)
An interactive training environment designed to familiarize pilots with Newtonian flight mechanics:
- Practice high-G break turns, induced drag velocity management, and flat scissors tail-reversals.
- Test double-tap lateral dash rolls and missile spoofing in a controlled sandbox.
- Spawn practice drones and test missiles on command to fine-tune deflection shooting and evasive timing.

---

## 4. Controls

| Key / Input | Action | Function |
| :--- | :--- | :--- |
| **`A` / `D`** or **`←` / `→`** | **Steer Aircraft** | Rotates nose heading left / right; initiates aerodynamic bank |
| **Double-Tap `A` / `D`** | **Lateral Dash / Roll** | Sudden burst of lateral impulse force to dodge missile vectors |
| **`Shift` (Left / Right)** | **Afterburner Boost** | Ignites engine afterburner for maximum thrust (consumes extra fuel) |
| **`C`** *(Hold)* | **20mm Rotary Cannon** | High-velocity ballistic cannon (500-round finite magazine) |
| **`X`** *(Hold)* | **Missile Hard-Lock** | Tracks hostile in $15^\circ$ nose cone for $0.5\text{s}$, then launches missile |
| **`Q`** | **Defensive Flares** | Deploys thermal decoy flare salvo to spoof incoming heatseekers |
| **`Space` / `Enter`** | **Confirm / Start / Restart** | Selects menu options, starts game, or restarts after debrief |
| **`1` / `2`** | **Quick Launch Mode** | Directly launches Survival Mode (`1`) or Dogfight Mode (`2`) |
| **`P`** | **Pause / Resume** | Pauses simulation clock and rendering loop |
| **`Esc`** | **Eject to Menu** | Aborts active flight sortie and returns to the main hangar |
| **`T`** *(Flight School)* | **Spawn Practice Drone** | Spawns a non-hostile aerial target drone for target practice |
| **`Y`** *(Flight School)* | **Spawn Practice Missile** | Spawns a single trailing missile behind your jet for evasion drills |

---

## 5. Setup & Local Installation

Because *Critical Knots* is built with pure web technologies and native ECMAScript modules (`type="module"`), no heavy compilation, transpilation, or package installations are required.

> **Note on ES Modules:** Modern web browsers enforce CORS security policies on ES modules loaded via the `file://` protocol. For optimal performance and asset loading, launch the project through a lightweight local HTTP development server.

### Option A: Python Built-in Server (Recommended)
If you have Python installed, open a terminal in the project directory and run:

```bash
# Python 3.x
python -m http.server 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```

### Option B: Node.js Development Server
If you prefer Node.js tooling:

```bash
# Using npx serve
npx serve .

# Or using http-server
npx http-server -p 8000
```

### Option C: VS Code Live Server Extension
1. Open the project folder in **Visual Studio Code**.
2. Install the **Live Server** extension by *Ritwick Dey*.
3. Right-click `index.html` and select **"Open with Live Server"**.

---

## 6. Project Architecture

```
/CriticalKnots
├── index.html               # Canvas host DOM, styling, and Google Font loaders
├── README.md                # Comprehensive project documentation
├── CLAUDE.md                # Technical guidelines and architectural constraints
├── PRD_Skyfall_Evasion.md   # Detailed mathematical and feature specification
└── src/
    ├── main.js              # RAF animation loop, phase orchestrator, game bootstrap
    ├── config.js            # Centralized tuning parameters and physics constants
    ├── state.js             # Global state container and clean restart manager
    ├── camera.js            # Dynamic lerp camera tracking, zoom, and screen shake
    ├── input.js             # Keyboard listeners, double-tap detection, and mouse state
    ├── entities/
    │   ├── player.js        # Player jet kinematics, drag, drift, and weapons
    │   ├── enemy.js         # Adversary AI, pursuit curves, RWR, and wingman logic
    │   ├── missile.js       # Proportional navigation seeker and boost/coast phases
    │   ├── bullet.js        # Ballistic cannon projectiles with aerodynamic drag
    │   ├── obstacle.js      # Procedural cloud cover and airspace obstacles
    │   └── particle.js      # High-performance pooled particle system (smoke, sparks, fire)
    ├── render/
    │   ├── hud.js           # Frosted glassmorphism UI, tactical radar, and debriefing
    │   └── sky.js           # Procedural atmospheric sky rendering, horizons, and stars
    ├── systems/
    │   ├── collision.js     # Spatial circle-circle and raycast collision detection
    │   ├── spawner.js       # Phased wave spawner and threat pacing
    │   ├── countermeasures.js# Flare physics and heat decoy logic
    │   └── parallax.js      # Multi-layered procedural parallax starfield
    └── utils/
        ├── math.js          # Scalar clamping, shortest angular difference, lerping
        └── vector.js        # 2D Euclidean distance, dot products, and angle helpers
```

---

## 7. Development Team

Developed with pride for the **TE INFT Computer Graphics Project (Semester V)** by:

- **Atharv Raut**
- **Manthan Rathi**
- **Shubham Mahanwar**

