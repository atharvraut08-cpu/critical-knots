/**
 * config.js — All tunable game parameters in one place
 * 
 * Every magic number lives here. Difficulty curve changes are a one-file diff.
 * Values sourced from PRD Section 5 tuning table.
 */

export const CONFIG = {
    // ── Metadata & Game Info ────────────────────────────
    gameTitle: 'Critical Knots',

    // ── Player & Flight Aerodynamics (Newtonian Physics) ─
    playerBaseSpeed: 220,       // px/s cruise speed
    playerTurnRate: 3.1,        // rad/s (+40% agile turn rate for dogfighting maneuverability)
    playerRadius: 14,           // collision radius
    boostMultiplier: 1.6,       // speed × this while boosting (352 px/s)
    boostFuelDrainMultiplier: 2.5, // fuel drain × this while boosting
    turnDragDecel: 130,         // px/s² speed bleed while banking (induced drag)
    minTurnSpeedFactor: 0.70,   // speed floor while turning (70% of top speed)
    planeAccelRate: 150,        // px/s² straight-line acceleration back up to cruise
    planeBoostAccelRate: 280,   // px/s² acceleration while boosting
    boostDecelRate: 135,        // px/s² smooth deceleration (momentum/drag) on releasing boost

    // Newtonian Aerodynamics & Drift
    thrustCruise: 450,          // px/s² engine forward thrust at cruise
    thrustBoost: 1152,          // px/s² engine forward thrust with afterburner
    dragCoeff: 0.0093,          // quadratic aerodynamic drag coeff: F_d = C_d * v^2
    lateralGrip: 3.8,           // s⁻¹ lateral restoring force pulling velocity vector to nose heading
    dashImpulse: 320,           // px/s sudden burst of lateral vector force (double-tap roll)
    dashCooldown: 0.75,         // seconds cooldown between lateral dashes

    // ── Guns & Ammo System ──────────────────────────────
    gunFireRate: 0.075,         // seconds between shots (~13.3 rounds/sec)
    bulletSpeed: 950,           // px/s muzzle velocity
    bulletLife: 1.1,            // seconds before despawning (~1045px range)
    bulletRadius: 3.5,          // collision radius, px
    bulletDragCoeff: 0.0018,    // high aerodynamic drag coefficient for bullets
    maxAmmo: 500,               // single hard-capped pool of 500 rounds total
    totalBullets: 500,          // total ammo supply

    // ── Dogfight Mode Parameters ────────────────────────
    dogfightLockTime: 0.5,      // exactly 0.5 seconds required to establish lock (reduced from 2.5s)
    playerLockConeAngle: 15 * Math.PI / 180, // 15-degree nose cone for player
    playerLockCosThreshold: Math.cos(15 * Math.PI / 180), // dot product threshold (~0.9659)
    playerDogfightMissiles: 6,  // strict limit of 6 missiles for player in dogfight mode
    enemyLockConeAngle: 30 * Math.PI / 180,  // 30-degree nose cone for AI
    enemyLockCosThreshold: Math.cos(30 * Math.PI / 180), // dot product threshold (~0.8660)
    enemyMissiles: 8,           // finite payload: 8 heat-seeking missiles per AI jet
    enemyFlares: 3,             // finite payload: 3 flares per AI jet
    enemyBaseSpeed: 175,        // px/s reduced cruise speed for enemy jet (gives player position advantage)
    enemyTurnRate: 1.30,        // rad/s reduced turn rate for enemy jet (player can easily out-turn)
    enemyRadius: 15,            // collision radius
    enemyFlareCriticalRadius: 280, // Euclidean distance check to pop defensive flare
    enemyLeadDistance: 350,     // px: threshold where AI uses Lead Pursuit (>350) vs Lag Pursuit (<=350)
    enemyLagOffset: 240,        // px: offset behind player's tail during Lag Pursuit

    // ── Missile Physics & Proportional Navigation ────────
    missileBoostDuration: 3.0,  // seconds of high-thrust engine boost
    missileBoostAccel: 280,     // px/s² high acceleration during boost phase
    missileCoastDrag: 0.00035,  // gentle aerodynamic glide drag coeff after engine cutoff
    missilePnGain: 3.5,         // Proportional Navigation guidance constant N (dTheta/dt = N * dLambda/dt)
    missileStallSpeed: 0,       // px/s stall threshold (lowered to zero to prevent speed-based deletion)
    missileMaxLifetime: 30.0,   // seconds max flight duration before self-destruct (increased to 30s)
    missileCullMargin: 2000,    // px outside camera viewport before entity cleanup
    enableMissileToMissileCollisions: false, // disabled to prevent missiles from vanishing in clusters

    // ── Fuel ────────────────────────────────────────────
    maxFuel: 100,
    fuelDrainRate: 4,           // per second (cruise)
    fuelCanisterRefill: 30,
    fuelFloorForBoost: 5,       // boost silently disabled below this

    // ── Missiles & Phased Difficulty Tuning ────────────
    warmupTime: 3.5,            // seconds before first missile
    phase1Interval: 2.6,        // Phase 1 (0 to 30s): steady cadence
    phase2Interval: 2.0,        // Phase 2 (30 to 60s): moderate cadence
    phase3BaseInterval: 1.8,    // Phase 3 (60s+): starting cooldown before exponential decay
    phase3HalfLife: 16,         // Phase 3 cooldown halves every N seconds
    spawnIntervalFloor: 0.45,   // minimum spawn interval floor
    spawnIntervalStart: 2.6,    // baseline start interval
    spawnRingMargin: 200,       // spawn this far beyond camera cull radius
    minSpawnDistFromPlayer: 450,// never spawn closer than this to player

    // Missile Archetypes:
    // Sleek, high-thrust projectiles (significantly faster than player's 352 px/s boost)
    missileTypes: {
        basic: {
            name: 'Basic',
            baseSpeed: 290,             // high muzzle launch speed
            maxSpeed: 430,              // 430 px/s (significantly higher than player max boost 352 px/s)
            accel: 95,
            turnRate: 1.60,             // agile tracking
            radius: 4,                  // slim, realistic missile radius
            color: '#94a3b8',           // grey
            hudDot: '#94a3b8',
            smokeColor: '180,185,195',
            trailRate: 0.024,
            shadowColor: '#94a3b8',
        },
        heavy: {
            name: 'Heavy',
            baseSpeed: 235,             // steady standoff launch
            maxSpeed: 390,              // 390 px/s (higher than player max boost 352 px/s)
            accel: 80,
            turnRate: 2.3,              // very sharp turn rate (high tracking)
            radius: 5,                  // slim, realistic heavy missile radius
            color: '#ff7700',           // orange
            hudDot: '#ff8800',
            smokeColor: '255,140,50',
            trailRate: 0.018,
            shadowColor: '#ff7700',
        },
        interceptor: {
            name: 'Interceptor',
            baseSpeed: 460,             // supersonic dart rocket
            maxSpeed: 550,              // 550 px/s (extreme standoff intercept speed)
            accel: 220,
            turnRate: 0,                // zero turn rate (straight line rocket)
            radius: 3.5,                // slim needle dart rocket radius
            color: '#ff1122',           // bright red
            hudDot: '#ff2233',
            smokeColor: '255,60,60',
            trailRate: 0.012,
            shadowColor: '#ff1122',
        },
        // Aliases for compatibility
        standard: {
            name: 'Basic',
            baseSpeed: 290,
            maxSpeed: 430,
            accel: 95,
            turnRate: 1.60,
            radius: 4,
            color: '#94a3b8',
            hudDot: '#94a3b8',
            smokeColor: '180,185,195',
            trailRate: 0.024,
            shadowColor: '#94a3b8',
        },
        fast: {
            name: 'Interceptor',
            baseSpeed: 460,
            maxSpeed: 550,
            accel: 220,
            turnRate: 0,
            radius: 3.5,
            color: '#ff1122',
            hudDot: '#ff2233',
            smokeColor: '255,60,60',
            trailRate: 0.012,
            shadowColor: '#ff1122',
        },
        hyper: {
            name: 'Interceptor',
            baseSpeed: 460,
            maxSpeed: 550,
            accel: 220,
            turnRate: 0,
            radius: 3.5,
            color: '#ff1122',
            hudDot: '#ff2233',
            smokeColor: '255,60,60',
            trailRate: 0.012,
            shadowColor: '#ff1122',
        },
    },

    // Legacy fallbacks
    homingSpeed: 290,
    homingTurnRate: 1.60,
    homingRadius: 4,
    rocketSpeed: 295,
    rocketTurnRate: 0,
    rocketRadius: 3.5,

    // ── Countermeasures: Flares ─────────────────────────
    maxFlares: 5,               // 5 static flares per run (no regeneration)
    flareCooldown: 0.8,         // seconds between uses
    flareBurstCount: 10,        // 8 to 12 flares deployed in a simultaneous burst
    flareSpreadAngle: 1.25,     // ~72 deg spread each side (wide fan pattern)
    flareMinSpeed: 140,         // px/s ejection speed min
    flareMaxSpeed: 240,         // px/s ejection speed max
    flareEjectionSpeed: 180,    // px/s baseline rearward/lateral ejection velocity
    flareDrag: 1.6,             // aerodynamic drag deceleration
    flareBurnDuration: 3.5,     // seconds of active burn
    flareSparkRate: 0.02,       // seconds between spark emissions
    flareSmokeRate: 0.016,      // heavy continuous smoke emission rate (thick arcs)
    flareSeekerFov: 1.35,       // ~77 deg seeker cone
    flareDetectionRadius: 480,  // px range to distract missiles
    flareAttractionChance: 0.90,// base chance to break missile lock

    // ── Camera ──────────────────────────────────────────
    cameraFollowSpeed: 4.0,     // lerp factor
    cameraCullFactor: 3.5,      // expanded cull factor so entities within 2000+ px margin are tracked
    shakeDecayRate: 8.0,        // shake magnitude decay per second
    shakeMaxMagnitude: 12,      // max shake offset in px

    // ── Sky / Visual ────────────────────────────────────
    skyLerpDuration: 180,       // seconds for full day→night cycle
    skyColorDay:   [135, 206, 235],  // light sky blue
    skyColorDusk:  [255, 140, 66],   // warm orange
    skyColorNight: [15, 15, 40],     // deep dark blue
    skyHorizonLighten: 34,      // how much lighter the horizon band is vs the zenith
    celestialRadius: 46,        // sun/moon disc radius, px
    celestialGlowRadius: 150,   // sun/moon outer glow radius, px
    celestialArcHeight: 0.55,   // fraction of canvas height the sun/moon arcs through
    starTwinkleSpeed: 1.8,      // twinkle oscillation speed, rad/s
    altitudeShadowOffset: 16,   // px offset for aircraft & missile drop shadows

    // ── Particles ───────────────────────────────────────
    maxParticles: 1500,         // expanded pool size for heavy multi-flare smoke trails
    smokeLifeMin: 0.3,          // seconds
    smokeLifeMax: 0.8,
    explosionLifeMin: 0.4,
    explosionLifeMax: 1.1,
    explosionParticleCount: 30, // particles per explosion burst
    trailEmitRate: 0.03,        // seconds between trail particle spawns

    // ── Pickups ─────────────────────────────────────────
    pickupSpawnInterval: 12,    // seconds between fuel canister spawns
    pickupRadius: 15,
    pickupSpawnRadius: 600,     // spawn within this distance ahead of player

    // ── Parallax ────────────────────────────────────────
    parallaxLayers: [
        { factor: 0.08, count: 50, sizeMin: 1, sizeMax: 2, color: 'rgba(255,255,255,0.4)', twinkle: true }, // stars
    ],
    parallaxTileSize: 2400,     // world units per tile repeat

    // ── Scoring ─────────────────────────────────────────
    nearMissRadius: 55,         // px — counts as a "near miss" for stats

    // ── Minimap / Radar ─────────────────────────────────
    minimapWidth: 155,          // px
    minimapHeight: 155,         // px
    minimapMargin: 20,          // px from canvas border
    minimapWorldRange: 2200,    // world units from player to minimap edge
    minimapBgColor: 'rgba(10, 15, 28, 0.65)',
    minimapBorderColor: 'rgba(96, 213, 255, 0.4)',
    minimapGridColor: 'rgba(255, 255, 255, 0.08)',
    minimapDotPlayer: '#ffffff',
    minimapDotPickup: '#22cc77',

    // ── Internal Resolution ─────────────────────────────
    canvasWidth: 1280,
    canvasHeight: 720,
};
