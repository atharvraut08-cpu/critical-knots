# PROJECT_DETAILS.md

# Critical Knots: A 2D Newtonian Flight Simulator
### Academic Technical Specification & Architecture Documentation

---

## 1. Project Header

- **Project Title:** Critical Knots (A 2D Newtonian Flight Simulator)
- **Course:** TE INFT — Computer Graphics (Semester V)
- **Institution:** Vidyalankar Institute of Technology (VIT), Mumbai
- **Faculty Guide:** Prof. Shruti Agrawal
- **Development Team:**
  - **Atharv Raut**
  - **Manthan Rathi**
  - **Shreyas Choudhary**
  - **Prem Ranmale**
  - **Shubham Mahanwar**

---

## 2. Technology Stack

- **Rendering Engine:** Native **HTML5 `<canvas>` API (2D Context)**. 
  - Strictly built **without any third-party game engines, physics engines, or rendering frameworks** (no Phaser, Pixi.js, Three.js, Babylon.js, or Matter.js).
  - Every transformation matrix, kinematic integration step, collision algorithm, and particle emitter is hand-implemented from first principles.
- **Programming Logic:** Pure **Vanilla JavaScript (ECMAScript 6+ / ES Modules)**.
  - Modular architecture utilizing native browser `import` and `export` statements (`<script type="module">`).
  - Zero build step, bundler, or transpilation dependency required to run or evaluate.
- **Styling & Typography:** Modern CSS3 host page utilizing system flexbox centering, frosted glassmorphism overlays, and Google Fonts (`Rajdhani` and `Outfit`) for HUD readouts.

---

## 3. Core Computer Graphics Concepts

The foundational deliverable of *Critical Knots* is the transparent, hand-crafted application of classic 2D Computer Graphics algorithms and geometric principles.

```
+-----------------------------------------------------------------------------+
|                        GRAPHICS PIPELINE ARCHITECTURE                       |
|                                                                             |
|   +-----------------------+              +------------------------------+   |
|   |   World Coordinate    |              |       Camera Viewport        |   |
|   |     Space (x, y)      |              |   Transform (worldToScreen)  |   |
|   +-----------+-----------+              +--------------+---------------+   |
|               |                                         |                   |
|               v                                         v                   |
|   +-----------------------+              +------------------------------+   |
|   |  Entity Kinematics    |              |     Local Object Matrix      |   |
|   |  & Heading Rotation   | -----------> |   ctx.save()                 |   |
|   |                       |              |   ctx.translate(sx, sy)      |   |
|   +-----------------------+              |   ctx.rotate(heading)        |   |
|                                          |   ctx.scale(sx, sy)          |   |
|                                          |   ... Draw Vector Geometry   |   |
|                                          |   ctx.restore()              |   |
|                                          +------------------------------+   |
+-----------------------------------------------------------------------------+
```

### 3.1 Affine Transformations & Matrix Stack Management
The rendering pipeline relies heavily on 2D affine transformation matrices to translate, rotate, and scale entities dynamically on each animation frame:
- **Matrix State Isolation (`ctx.save()` / `ctx.restore()`):**  
  Every entity (airframe, missile, ballistic tracer, decoy flare, thruster exhaust, and cloud puff) operates in its own local coordinate space. To prevent transformation leakage across render passes, the canvas matrix state is saved and restored around each draw routine.
- **Translation (`ctx.translate(screenX, screenY)`):**  
  Maps an entity’s continuous world coordinate $\vec{p} = [x, y]^T$ into camera-relative viewport space $\vec{p}_{\text{screen}} = \vec{p} - \vec{p}_{\text{cam}} + [\frac{W}{2}, \frac{H}{2}]^T$, moving the canvas origin directly to the object center.
- **Rotation (`ctx.rotate(\theta)`):**  
  Orbits all subsequent local drawing paths by the entity's instantaneous heading angle $\theta$. This enables aerodynamic shapes, wings, control surfaces, and thrust plumes to automatically orient along their nose vectors without manual vertex rotation formulas.
- **Dynamic Scaling & Reflection (`ctx.scale(s_x, s_y)`):**
  - **Altitude Elevation & Shadows:** Altitude drop shadows are rendered using scaled-down affine passes ($s_x, s_y \approx 0.82$) offset along the simulated sun lighting vector before the main airframe is drawn.
  - **Barrel Roll Projection:** During lateral evasive rolls, the transverse scale factor $s_x$ smoothly oscillates using cosine interpolation ($\cos(\omega t)$) from $1.0 \to 0.0 \to -1.0 \to 1.0$, rendering a 3D-like barrel roll illusion entirely on a 2D surface.

### 3.2 Vector Mathematics & Spatial Calculations

```
                        MISSILE TARGET LOCK CONE (15° FOV)
                                
                                \     +15°    /
                                 \           /
                                  \  Target /  <-- Target Vector (p_target - p_player)
                                   \   [X] /
                                    \  *  /
                                     \ | /
           Aircraft Nose Vector --->  \|/  (dot >= cos(15°) ~ 0.9659)
                                     [A/C]
```

- **Dot Product & Forward Boresight Radar Cone (Target Acquisition):**  
  Missile tracking and hard-lock targeting operate through the 2D Euclidean dot product between the aircraft's normalized longitudinal unit heading vector $\vec{u}_{\text{nose}}$ and the normalized line-of-sight (LOS) direction vector to the target $\vec{u}_{\text{target}}$:
  $$\cos\phi = \vec{u}_{\text{nose}} \cdot \vec{u}_{\text{target}} = \frac{\vec{u}_{\text{nose}} \cdot (\vec{p}_{\text{target}} - \vec{p}_{\text{player}})}{\|\vec{p}_{\text{target}} - \vec{p}_{\text{player}}\|}$$
  - **$15^\circ$ Radar Boresight Cone:** A hostile fighter or drone is detected within the acquisition cone if:
    $$\cos\phi \ge \cos(15^\circ) \approx 0.965926$$
  - **Lock-On Timer Accumulator:** When $\cos\phi \ge 0.9659$, an internal timer increments. Maintaining continuous boresight alignment for **$0.5\text{s}$** transitions the targeting system into a verified hard-lock (`state.locked = true`), allowing immediate missile launch.
- **Euclidean Distance & Proximity Detection:**  
  Spatial proximity across entities is calculated via the 2D Euclidean metric:
  $$d(\vec{p}_1, \vec{p}_2) = \|\vec{p}_1 - \vec{p}_2\| = \sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2}$$
  - **Bounding Circle Collision:** Centralized in `src/systems/collision.js`, all physical body interactions (aircraft vs. missile, bullet vs. fuselage, missile vs. missile) leverage fast squared-distance tests ($d^2 \le (r_1 + r_2)^2$) to avoid costly square-root computations in broad-phase loops.
  - **Flare Decoy Proximity:** Incoming heat-seeking missiles compute the Euclidean distance to active pyrotechnic flares. If a flare enters a missile's seeker radius ($r_{\text{seeker}} \le 350\text{px}$), the missile's guidance system probabilistically breaks lock from the player and diverts toward the higher thermal signature.

---

## 4. Newtonian Physics & Kinematics

Unlike arcade games that rigidly couple an aircraft's position or movement direction to its sprite rotation angle, *Critical Knots* runs a true Newtonian aerodynamic simulation governed by second-order ordinary differential equations solved via Euler integration with $\Delta t$ clamping ($\Delta t \le 0.05\text{s}$).

```
                     DECOUPLED FLIGHT DYNAMICS & AERODYNAMIC DRIFT
                                      
                                        Nose Heading (theta)
                                            ^
                                           /|
                             Thrust Force / |  Sideslip Angle (beta)
                                  a_thrust  | /
                                          \ |/
                                           (Player) -------> Velocity Vector (v)
                                            |
                                            | Lateral Restoring Force
                                            v (a_restore = -k_grip * v_lat * u_lat)
```

### 4.1 Aerodynamic Drift & Decoupled Flight Kinematics
- **Decoupled State Representation:** The aircraft state maintains an independent longitudinal orientation angle $\theta$ and a 2D Cartesian velocity vector $\vec{v} = [v_x, v_y]^T$.
- **Engine Thrust Vectoring:** Forward engine thrust accelerates the aircraft strictly along its forward longitudinal axis:
  $$\vec{u}_{\text{nose}} = \begin{bmatrix} \cos\theta \\ \sin\theta \end{bmatrix}, \quad \vec{a}_{\text{thrust}} = T \cdot \vec{u}_{\text{nose}}$$
- **Lateral Grip & Restoring Force:** When turning, the velocity vector $\vec{v}$ does not instantaneously align with the nose, generating a sideslip angle $\beta$. The airframe's wings and vertical stabilizer exert an aerodynamic lateral restoring force that continuously dampens lateral drift velocity:
  $$\vec{u}_{\text{lateral}} = \begin{bmatrix} -\sin\theta \\ \cos\theta \end{bmatrix}$$
  $$v_{\text{lateral}} = \vec{v} \cdot \vec{u}_{\text{lateral}} = -v_x \sin\theta + v_y \cos\theta$$
  $$\vec{a}_{\text{restore}} = -k_{\text{grip}} \cdot v_{\text{lateral}} \cdot \vec{u}_{\text{lateral}}$$
  This decoupling enables pilots to perform high-G drift banks, snap maneuvers, and lateral rolls while their momentum slides along a continuous trajectory.

### 4.2 Quadratic Aerodynamic Drag ($F_d \propto v^2$)
True fluid resistance is non-linear and proportional to the square of kinetic velocity:
$$\vec{F}_d = -\frac{1}{2} \rho C_d A \|\vec{v}\|^2 \hat{v} = -C_d \cdot \|\vec{v}\|^2 \cdot \frac{\vec{v}}{\|\vec{v}\|}$$
- **Natural Terminal Velocity:** By implementing quadratic drag, maximum speed balances naturally when thrust equals drag ($T = C_d v_{\text{term}}^2$), eliminating the need for artificial hard speed caps.
- **Induced Drag & Energy Management:** Tight turns introduce induced aerodynamic drag:
  $$\vec{a}_{\text{induced\_drag}} = -k_{\text{induced}} \cdot |\omega| \cdot \vec{v}$$
  Executing hard break turns or sustained high-rate reversals bleeds forward airspeed dynamically.
- **Flat Scissors Maneuver:** By rapidly alternating turn direction left and right, pilots bleed energy through induced and quadratic drag, causing high-speed trailing missiles and pursuing AI jets to overshoot their target.

### 4.3 Velocity Inheritance (Momentum Vector Addition)
All ballistic projectiles (such as 20mm rotary cannon rounds) hand-calculate vector momentum inheritance upon firing:
$$\vec{v}_{\text{bullet}} = \vec{v}_{\text{aircraft}} + v_{\text{muzzle}} \cdot \vec{u}_{\text{nose}}$$
- Cannon rounds inherit the exact forward and lateral velocity of the aircraft at the moment of discharge.
- Firing during a high-speed drift or roll alters the ballistic trajectory relative to the camera, requiring pilots to lead deflection shots naturally according to Galilean relativity.

---

## 5. Autonomous AI & Steering Behaviors

Adversary aircraft and heat-seeking ordnance feature autonomous steering behaviors implemented through vector mathematics and classical guidance laws.

```
                  PROPORTIONAL NAVIGATION (PN) MISSILE GUIDANCE
                     
                      Missile Position (p_m)               Adversary Position (p_t)
                             [M] ----------------------------> [T]
                              \               Line-of-Sight     /
                               \                 (LOS, lambda) /
                            v_m \                             / v_t
                                 \                           /
                                  \                         v
                                   v                       (Predicted Intercept)
                                    \                     /
                                     \                   /
                                      \                 /
                                       v               v
                                        *  INTERCEPT  *
```

### 5.1 Proportional Navigation (PN) Missile Guidance
Rather than exhibiting naive pure pursuit (pointing the nose directly at the target’s current position, which produces easily dodged trailing arcs), homing missiles implement **Proportional Navigation (PN)**:
$$\dot{\theta} = N \cdot \dot{\lambda}$$
- **$\lambda$ (Line-of-Sight Angle):** The angle between the missile and the target:
  $$\lambda = \text{atan2}(y_{\text{target}} - y_{\text{missile}}, x_{\text{target}} - x_{\text{missile}})$$
- **$\dot{\lambda}$ (Line-of-Sight Angular Velocity):** The time rate of change of the LOS vector:
  $$\dot{\lambda} = \frac{(\vec{v}_{\text{rel}} \times \vec{r}_{\text{rel}})_z}{\|\vec{r}_{\text{rel}}\|^2}$$
- **$N$ (Navigation Constant):** Configured to $N = 3.5$.  
- **Kinematic Consequence:** The missile steers toward the predicted future collision point where the line of sight remains stationary ($\dot{\lambda} \to 0$). To evade a PN missile, a pilot cannot simply fly in a straight line; they must execute high-G break turns or rapid lateral rolls to maximize $\dot{\lambda}$ beyond the missile’s maximum aerodynamic turning limit.
- **Dual Boost & Coast Flight Envelope:** Missiles burn rocket motor fuel under high thrust for $3.0\text{s}$, followed by an unpowered coast phase where aerodynamic drag degrades forward speed and fin turn authority.

### 5.2 Pursuit Curves & Flocking Separation

```
                            AI FIGHTER JET PURSUIT MODES
                            
        1. LEAD PURSUIT (Distance > 350px):
           AI Jet steers ahead of player velocity vector to close distance.
           
           AI Jet ----------> Predicted Intercept Point (*) <----- Player Jet
           
        2. LAG PURSUIT (Distance <= 350px):
           AI Jet steers behind player tail to settle in firing position without overshoot.
           
           Player Jet ----->
                  ^
                  |  Lag Arc
           AI Jet -'
           
        3. FLOCKING SEPARATION (Radius = 150px):
           Repulsion Vector = -scale(normalize(delta), (150 - dist) / 150)
```

Adversary AI jets (**BOGEY-1** and **BOGEY-2**) operate through autonomous steering state machines:
- **Lead Pursuit ($d > 350\text{px}$):**  
  At long standoff ranges, the AI calculates a predictive intercept point based on the player’s instantaneous velocity vector:
  $$\vec{p}_{\text{lead}} = \vec{p}_{\text{player}} + \vec{v}_{\text{player}} \cdot t_{\text{intercept}}$$
  The jet steers toward $\vec{p}_{\text{lead}}$ to close distance efficiently.
- **Lag Pursuit ($d \le 350\text{px}$):**  
  Once in close combat, switching to lead pursuit would cause the AI to overshoot the player. The AI smoothly blends into **Lag Pursuit**, steering toward the player's tail vector:
  $$\vec{p}_{\text{lag}} = \vec{p}_{\text{player}} - 120 \cdot \vec{u}_{\text{player\_nose}}$$
  This keeps the adversary tracking in an offensive position directly behind the player's six o'clock.
- **Flocking & Spatial Separation ($r_{\text{sep}} = 150\text{px}$):**  
  To prevent wingmen from colliding or overlapping, each AI jet calculates a mutual repulsive vector when within $150\text{px}$ of each other:
  $$\vec{F}_{\text{sep}} = \sum_{j \ne i} \frac{\vec{p}_i - \vec{p}_j}{\|\vec{p}_i - \vec{p}_j\|} \cdot \left(1 - \frac{\|\vec{p}_i - \vec{p}_j\|}{r_{\text{sep}}}\right)$$
  This repulsive impulse is superimposed onto the steering solution, ensuring coordinated tactical wingman spacing.

---

## 6. Game Modes

*Critical Knots* includes two distinct gameplay simulations tailored to test different aspects of Computer Graphics math and aerodynamic evasion.

```
+-----------------------------------------------------------------------------+
|                                GAME MODES                                   |
+-----------------------------------------------------------------------------+
|                                                                             |
|  [1] SURVIVAL MODE (Endless Phased Escalation)                              |
|      - Continuous missile evasion challenge.                                |
|      - Phase 1 (Recon, 0-30s)        : Basic PN heat-seekers.               |
|      - Phase 2 (Escalation, 30-60s)   : High-speed Interceptors & Heavy      |
|                                        warhead tracking missiles.           |
|      - Phase 3 (Sudden Death, 60s+)   : Exponential spawn frequency decay,   |
|                                        dense multi-threat salvos.           |
|                                                                             |
|  [2] DOGFIGHT MODE (1v2 Tactical Air Combat)                                |
|      - Direct engagement against coordinated AI fighters (BOGEY-1 & 2).     |
|      - Finite Armaments: 500 rounds 20mm cannon, 6 missiles, 5 flares.      |
|      - Radar Warning Receiver (RWR) visual/auditory missile lock alert.     |
|      - Defeat both hostiles to claim Air Superiority.                       |
|                                                                             |
+-----------------------------------------------------------------------------+
```

### 6.1 Survival Mode (Endless Phased Escalation)
Survival Mode is an arcade endurance challenge where the pilot survives against waves of autonomous guided missiles with phased escalation:
- **Phase 1: Recon (0 to 30 Seconds):**  
  - Missile Spawns: Standard **BASIC** tracking missiles spawning at a steady $3.5\text{s}$ interval.
  - Objective: Pilot familiarization with Newtonian drift banking, momentum conservation, and flare decoy timing.
- **Phase 2: Escalation (30 to 60 Seconds):**  
  - Missile Spawns: Spawn interval drops to $2.2\text{s}$, introducing specialized threat archetypes:
    - **INTERCEPTORS:** Ultra-high velocity ($v_{\text{max}} = 484\text{px/s}$), straight-line sprint rockets designed to punish predictable paths.
    - **HEAVY TRACKERS:** High-turn-rate homing warheads ($v_{\text{max}} = 343\text{px/s}$) with extended rocket motor burn durations.
  - Threat Environment: Requires aggressive double-tap lateral dash rolls and threading missiles into near-miss proximity orbits to force them to collide with one another.
- **Phase 3: Sudden Death (60+ Seconds):**  
  - Spawn Interval Exponential Decay:
    $$\text{interval}(t) = \text{clamp}\left(1.8 \cdot e^{-0.015(t - 60)}, 0.65\text{s}, 2.0\text{s}\right)$$
  - Rapid multi-missile salvos saturate the airspace, demanding mastery of induced drag speed bleeding, flare salvo deployment, and tight turn maneuvers.

### 6.2 Dogfight Mode (Tactical 1v2 Air Combat)
Dogfight Mode simulates an authentic tactical beyond-visual-range (BVR) and within-visual-range (WVR) dogfight against two coordinating AI adversary fighters (**BOGEY-1** and **BOGEY-2**):
- **Finite Armament Constraints:**  
  Combatants operate with strictly capped payloads:
  - **500 Rounds** of high-velocity 20mm ballistic rotary cannon ammunition.
  - **6 Hard-Lock Heat-Seeking Missiles** requiring sustained $0.5\text{s}$ radar boresight lock.
  - **5 Defensive Thermal Decoy Flares** to decoy incoming hostile missiles.
- **Radar Warning Receiver (RWR):**  
  Equipped with simulated avionics that trigger visual and high-visibility auditory alerts when an enemy fighter achieves tail-aspect lock on the player.
- **Tactical Win / Loss Superiority Conditions:**  
  Downing both hostile fighters secures Air Superiority (`VICTORY`); suffering airframe destruction results in `DEFEAT`.

---

## 7. Mathematical & Architectural Summary

| Concept / Module | Implementation Location | Mathematical Equation / Logic |
| :--- | :--- | :--- |
| **Affine Coordinate Transforms** | `src/camera.js`, `src/render/*.js` | $\vec{p}_{\text{screen}} = \mathbf{M}_{\text{cam}} \cdot \vec{p}_{\text{world}}$, `ctx.save()`, `translate()`, `rotate()`, `scale()` |
| **Target Lock Cone (FOV)** | `src/entities/player.js` | $\cos\phi = \vec{u}_{\text{nose}} \cdot \vec{u}_{\text{target}} \ge \cos(15^\circ) \approx 0.9659$ for $t \ge 0.5\text{s}$ |
| **Aerodynamic Drift** | `src/entities/player.js` | $\vec{a}_{\text{restore}} = -k_{\text{grip}} (\vec{v} \cdot \vec{u}_{\text{lat}}) \vec{u}_{\text{lat}}$ |
| **Quadratic Fluid Drag** | `src/entities/player.js`, `missile.js` | $\vec{F}_d = -C_d \|\vec{v}\|^2 \hat{v}$ |
| **Velocity Inheritance** | `src/entities/bullet.js` | $\vec{v}_{\text{bullet}} = \vec{v}_{\text{aircraft}} + v_{\text{muzzle}} \cdot \vec{u}_{\text{nose}}$ |
| **Proportional Navigation** | `src/entities/missile.js` | $\dot{\theta} = N \cdot \dot{\lambda} \quad (N = 3.5)$ |
| **Flocking & Separation** | `src/entities/enemy.js` | $\vec{F}_{\text{sep}} = \sum \hat{r}_{ij} \left(1 - \frac{d_{ij}}{150}\right)$ for $d_{ij} < 150\text{px}$ |
| **Pursuit State Curves** | `src/entities/enemy.js` | Lead Intercept ($d > 350\text{px}$) vs. Lag Tail Arc ($d \le 350\text{px}$) |
| **Particle Simulation** | `src/entities/particle.js` | Pre-allocated circular ring buffer pool; zero garbage-collector overhead |

