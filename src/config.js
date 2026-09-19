/**
 * config.js — All tunable game parameters in one place
 * 
 * Every magic number lives here. Difficulty curve changes are a one-file diff.
 * Values sourced from PRD Section 5 tuning table.
 */

export const CONFIG = {
    // ── Player ──────────────────────────────────────────
    playerBaseSpeed: 220,       // px/s cruise speed
    playerTurnRate: 2.2,        // rad/s
    playerRadius: 14,           // collision radius
    boostMultiplier: 1.6,       // speed × this while boosting
    boostFuelDrainMultiplier: 2.5, // fuel drain × this while boosting

    // ── Fuel ────────────────────────────────────────────
    maxFuel: 100,
    fuelDrainRate: 4,           // per second (cruise)
    fuelCanisterRefill: 30,
    fuelFloorForBoost: 5,       // boost silently disabled below this

    // ── Missiles ────────────────────────────────────────
    warmupTime: 4,              // seconds before first missile
    spawnIntervalStart: 3.5,    // seconds between spawns at t=0
    spawnIntervalFloor: 0.8,    // minimum spawn interval
    spawnIntervalHalfLife: 25,  // interval halves every N seconds of survival
    spawnRingMargin: 200,       // spawn this far beyond camera cull radius
    minSpawnDistFromPlayer: 400,// never spawn closer than this to player

    homingSpeed: 160,           // px/s
    homingTurnRate: 1.1,        // rad/s
    homingRadius: 8,            // collision radius

    rocketSpeed: 260,           // px/s
    rocketTurnRate: 0,          // unguided — locks heading at spawn
    rocketRadius: 7,

    // Archetype mix: fraction of homing missiles
    archetypeMixStart: 0.80,    // 80% homing at start
    archetypeMixEnd: 0.50,      // 50% homing at 90s
    archetypeMixTransitionTime: 90, // seconds to reach end mix

    // ── Countermeasures ─────────────────────────────────
    maxFlares: 3,
    flareRegenTime: 20,         // seconds to regen 1 charge
    flareConfuseRadius: 180,    // px
    flareConfuseDuration: 2.5,  // seconds
    flareCooldown: 0.5,         // seconds between uses

    maxEmp: 1,
    empRegenTime: 45,           // seconds to regen 1 charge
    empKillRadius: 260,         // px
    empCooldown: 1.0,           // seconds between uses

    // ── Camera ──────────────────────────────────────────
    cameraFollowSpeed: 4.0,     // lerp factor
    cameraCullFactor: 1.5,      // cull entities beyond this × screen diagonal
    shakeDecayRate: 8.0,        // shake magnitude decay per second
    shakeMaxMagnitude: 12,      // max shake offset in px

    // ── Sky / Visual ────────────────────────────────────
    skyLerpDuration: 180,       // seconds for full day→night cycle
    skyColorDay:   [135, 206, 235],  // light sky blue
    skyColorDusk:  [255, 140, 66],   // warm orange
    skyColorNight: [15, 15, 40],     // deep dark blue
    skyHorizonLighten: 34,      // how much lighter the horizon band is vs the zenith (gradient depth)
    celestialRadius: 46,        // sun/moon disc radius, px
    celestialGlowRadius: 150,   // sun/moon outer glow radius, px
    celestialArcHeight: 0.55,   // fraction of canvas height the sun/moon arcs through
    starTwinkleSpeed: 1.8,      // twinkle oscillation speed, rad/s

    // ── Particles ───────────────────────────────────────
    maxParticles: 300,          // pre-allocated pool size
    smokeLifeMin: 0.3,         // seconds
    smokeLifeMax: 0.8,
    explosionLifeMin: 0.4,
    explosionLifeMax: 1.0,
    explosionParticleCount: 25, // particles per explosion burst
    trailEmitRate: 0.03,        // seconds between trail particle spawns

    // ── Obstacles ───────────────────────────────────────
    obstacleCount: 15,          // number of obstacles to scatter in play area
    obstacleSpawnRadius: 2000,  // scatter within this world radius
    obstacleMinRadius: 25,
    obstacleMaxRadius: 55,

    // ── Pickups ─────────────────────────────────────────
    pickupSpawnInterval: 12,    // seconds between fuel canister spawns
    pickupRadius: 15,
    pickupSpawnRadius: 600,     // spawn within this distance ahead of player

    // ── Parallax ────────────────────────────────────────
    parallaxLayers: [
        { factor: 0.1, count: 60, sizeMin: 1, sizeMax: 2, color: 'rgba(255,255,255,0.4)', twinkle: true },  // distant stars
        { factor: 0.3, count: 30, sizeMin: 2, sizeMax: 5, color: 'rgba(200,200,220,0.25)' },  // mid clouds
        { factor: 0.5, count: 15, sizeMin: 4, sizeMax: 8, color: 'rgba(180,180,200,0.15)' },  // near details
    ],
    parallaxTileSize: 2000,     // world units per tile repeat

    // ── Scoring ─────────────────────────────────────────
    nearMissRadius: 50,         // px — counts as a "near miss" for stats

    // ── Internal Resolution ─────────────────────────────
    canvasWidth: 1280,
    canvasHeight: 720,
};
