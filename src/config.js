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
    boostMultiplier: 1.6,       // speed × this while boosting (352 px/s)
    boostFuelDrainMultiplier: 2.5, // fuel drain × this while boosting

    // ── Fuel ────────────────────────────────────────────
    maxFuel: 100,
    fuelDrainRate: 4,           // per second (cruise)
    fuelCanisterRefill: 30,
    fuelFloorForBoost: 5,       // boost silently disabled below this

    // ── Missiles ────────────────────────────────────────
    warmupTime: 3.5,            // seconds before first missile
    spawnIntervalStart: 3.2,    // seconds between spawns at t=0
    spawnIntervalFloor: 0.75,   // minimum spawn interval
    spawnIntervalHalfLife: 22,  // interval halves every N seconds of survival
    spawnRingMargin: 200,       // spawn this far beyond camera cull radius
    minSpawnDistFromPlayer: 450,// never spawn closer than this to player

    // Missile Archetypes:
    // - standard (Sidewinder): balanced heatseeker, matches cruise speed
    // - heavy (Titan): slow, high agility/turn-rate, thick smoke, large explosion
    // - fast (Falcon): 295 px/s, faster than player cruise speed (220)
    // - hyper (Viper): 385 px/s, faster than player boost (352), high inertia
    missileTypes: {
        standard: {
            name: 'Sidewinder',
            baseSpeed: 215,
            maxSpeed: 235,
            accel: 55,
            turnRate: 1.25,
            radius: 8,
            color: '#ff3344',
            hudDot: '#ff4455',
            smokeColor: '200,200,210',
            trailRate: 0.025,
        },
        heavy: {
            name: 'Titan',
            baseSpeed: 130,
            maxSpeed: 155,
            accel: 30,
            turnRate: 1.85,
            radius: 12,
            color: '#cc1122',
            hudDot: '#ff2233',
            smokeColor: '70,70,80',
            trailRate: 0.018,
        },
        fast: {
            name: 'Falcon',
            baseSpeed: 250,
            maxSpeed: 295,
            accel: 90,
            turnRate: 0.85,
            radius: 7,
            color: '#ff7700',
            hudDot: '#ff9900',
            smokeColor: '230,170,100',
            trailRate: 0.02,
        },
        hyper: {
            name: 'Viper',
            baseSpeed: 280,
            maxSpeed: 385,
            accel: 135,
            turnRate: 0.42,
            radius: 6,
            color: '#e022ff',
            hudDot: '#f033ff',
            smokeColor: '200,120,255',
            trailRate: 0.015,
        },
    },

    // Legacy fallbacks
    homingSpeed: 215,
    homingTurnRate: 1.25,
    homingRadius: 8,
    rocketSpeed: 295,
    rocketTurnRate: 0,
    rocketRadius: 7,

    // ── Countermeasures: Flares ─────────────────────────
    maxFlares: 3,
    flareRegenTime: 18,         // seconds to regen 1 charge
    flareCooldown: 0.6,         // seconds between uses
    flareEjectionSpeed: 130,    // px/s rearward/lateral ejection velocity
    flareDrag: 1.8,             // aerodynamic drag deceleration
    flareBurnDuration: 3.5,     // seconds of active burn
    flareSparkRate: 0.025,      // seconds between spark emissions
    flareSmokeRate: 0.04,       // seconds between smoke emissions
    flareSeekerFov: 1.35,       // ~77 deg seeker cone
    flareDetectionRadius: 450,  // px range to distract missiles
    flareAttractionChance: 0.88,// base chance to break missile lock

    // ── Countermeasures: EMP ────────────────────────────
    maxEmp: 1,
    empRegenTime: 40,           // seconds to regen 1 charge
    empCooldown: 1.2,           // seconds between uses
    empRadius: 380,             // maximum pulse expansion radius, px
    empExpansionSpeed: 640,     // wave expansion speed, px/s
    empDisruptDurationMin: 2.5, // seconds disabled at edge
    empDisruptDurationMax: 4.5, // seconds disabled at epicenter
    empHudGlitchDuration: 0.55, // seconds of HUD static / digital noise

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
    skyHorizonLighten: 34,      // how much lighter the horizon band is vs the zenith
    celestialRadius: 46,        // sun/moon disc radius, px
    celestialGlowRadius: 150,   // sun/moon outer glow radius, px
    celestialArcHeight: 0.55,   // fraction of canvas height the sun/moon arcs through
    starTwinkleSpeed: 1.8,      // twinkle oscillation speed, rad/s
    altitudeShadowOffset: 16,   // px offset for aircraft & missile drop shadows

    // ── Particles ───────────────────────────────────────
    maxParticles: 500,          // pre-allocated pool size
    smokeLifeMin: 0.3,          // seconds
    smokeLifeMax: 0.8,
    explosionLifeMin: 0.4,
    explosionLifeMax: 1.1,
    explosionParticleCount: 30, // particles per explosion burst
    trailEmitRate: 0.03,        // seconds between trail particle spawns

    // ── Environmental Obstacles ─────────────────────────
    obstacleCount: 16,          // total number of environmental obstacles
    obstacleSpawnRadius: 2200,  // scatter within this world radius
    obstacleMinRadius: 40,
    obstacleMaxRadius: 110,

    // ── Pickups ─────────────────────────────────────────
    pickupSpawnInterval: 12,    // seconds between fuel canister spawns
    pickupRadius: 15,
    pickupSpawnRadius: 600,     // spawn within this distance ahead of player

    // ── Parallax ────────────────────────────────────────
    parallaxLayers: [
        { factor: 0.08, count: 50, sizeMin: 1, sizeMax: 2, color: 'rgba(255,255,255,0.4)', twinkle: true }, // stars
        { factor: 0.25, count: 25, sizeMin: 40, sizeMax: 90, color: 'rgba(255,255,255,0.18)', isCloud: true }, // high cirrus
        { factor: 0.45, count: 18, sizeMin: 70, sizeMax: 150, color: 'rgba(240,245,255,0.22)', isCloud: true }, // mid cumulus
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
    minimapDotObstacle: '#8899aa',

    // ── Internal Resolution ─────────────────────────────
    canvasWidth: 1280,
    canvasHeight: 720,
};
