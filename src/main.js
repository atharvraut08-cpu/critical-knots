/**
 * main.js — Game loop bootstrap and orchestrator
 * 
 * Ties all modules together: canvas setup, RAF loop with dt clamp,
 * game phase management (title → playing → gameover), and the
 * update/render orchestrators that call into each system.
 */

import { CONFIG } from './config.js';
import state, { reset } from './state.js';
import keys, { initInput, consumeAction } from './input.js';
import camera, { updateCamera, worldToScreen, isVisible, resetCamera } from './camera.js';
import { createPlayer, updatePlayer, drawPlayer, drawBullet } from './entities/player.js';
import { updateMissile, drawMissile } from './entities/missile.js';
import { drawObstacle } from './entities/obstacle.js';
import { updatePickup, drawPickup } from './entities/pickup.js';
import { initParticles, updateParticles, drawParticles, emitTrail } from './entities/particle.js';
import { checkAllCollisions } from './systems/collision.js';
import { updateSpawner, scatterObstacles } from './systems/spawner.js';
import { updateCountermeasures, drawCountermeasures } from './systems/countermeasures.js';
import { initParallax, drawParallax } from './systems/parallax.js';
import { drawSky } from './render/sky.js';
import { drawTitleScreen, drawHUD, drawGameOverScreen } from './render/hud.js';

// ── Canvas setup ────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Fixed internal render resolution (CSS scales to fill window)
canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

// ── Mobile detection (Risk #4) ──────────────────────────
// Non-blocking: shows warning on genuine mobile devices but game still initializes
function checkMobileDevice() {
    const isMobileUA = /Android.*Mobile|iPhone|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
    if (isMobileUA) {
        const msg = document.getElementById('mobileWarning');
        if (msg) msg.style.display = 'flex';
    }
}

// ── Game initialization ─────────────────────────────────
let lastTime = 0;

function init() {
    checkMobileDevice();

    initInput();
    initParticles();
    initParallax();

    state.phase = 'title';
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

/**
 * Start a new game run.
 */
function startGame() {
    reset();
    initParticles();
    initParallax();

    const player = createPlayer();
    state.player = player;

    // Scatter obstacles around the world
    scatterObstacles(state);

    // Reset camera to player position (no lag on start)
    resetCamera(player.x, player.y);

    state.phase = 'playing';
}

// ── Main loop ───────────────────────────────────────────
/**
 * RAF loop with delta-time clamping.
 * The 0.05s clamp prevents "spiral of death" on tab-switch resume
 * (Risk #1 mitigation). All motion is dt-scaled for frame-rate
 * independence — game speed is identical at 30 FPS and 60 FPS.
 */
function loop(timestamp) {
    // Delta time: capped to prevent tunneling/teleport on resume
    const rawDt = (timestamp - lastTime) / 1000;
    const dt = Math.min(rawDt, 0.05); // clamp at 0.05s max
    lastTime = timestamp;

    // ── Phase-specific input handling ───────────────────
    if (state.phase === 'title') {
        if (consumeAction('mode1')) {
            state.gameMode = 'survival';
        }
        if (consumeAction('mode2')) {
            state.gameMode = 'freeflight';
        }
        if (consumeAction('start')) {
            startGame();
        }
    } else if (state.phase === 'gameover') {
        // Debounced restart via Space (or R) — only on game-over screen
        if (consumeAction('restart') || consumeAction('start')) {
            startGame();
        }
    } else if (state.phase === 'playing') {
        // Pause toggle
        if (consumeAction('pause')) {
            state.paused = !state.paused;
        }
    }

    // ── Update (skip if paused) ─────────────────────────
    if (state.phase === 'playing' && !state.paused) {
        update(dt);
    }

    // ── Render (always) ─────────────────────────────────
    render();

    requestAnimationFrame(loop);
}

// ── Update orchestrator ─────────────────────────────────
function update(dt) {
    const player = state.player;
    if (!player) return;

    // Track survival time
    state.timeAlive += dt;

    // Player
    updatePlayer(player, dt, keys);

    // Check for fuel death
    if (!player.alive) {
        onPlayerDeath();
        return;
    }

    // Spawner (missiles + pickups)
    updateSpawner(state, dt, CONFIG.canvasWidth, CONFIG.canvasHeight);

    // Update missiles
    for (const m of state.missiles) {
        updateMissile(m, dt, player, state.flares, state.timeAlive);
    }

    // Countermeasures (flare + EMP)
    updateCountermeasures(state, dt, keys);

    // Update pickups
    for (const pk of state.pickups) {
        updatePickup(pk, dt);
    }

    // Collision detection (centralized in systems/collision.js)
    checkAllCollisions(state);

    // Check if player died from collision
    if (!player.alive) {
        onPlayerDeath();
        return;
    }

    // Particle system
    updateParticles(dt);

    // Emit player exhaust trail
    if (player.trailTimer <= 0) {
        const tailX = player.x - Math.cos(player.heading) * player.radius;
        const tailY = player.y - Math.sin(player.heading) * player.radius;
        emitTrail(tailX, tailY, player.heading,
            player.boosting ? '255,180,50' : '150,180,220');
        player.trailTimer = CONFIG.trailEmitRate;
    }

    // Emit missile smoke trails
    for (const m of state.missiles) {
        if (!m.alive) continue;
        if (m.trailTimer <= 0) {
            const tailX = m.x - Math.cos(m.heading) * m.radius;
            const tailY = m.y - Math.sin(m.heading) * m.radius;
            const mDef = CONFIG.missileTypes[m.type] || CONFIG.missileTypes.standard;
            const trailColor = m.disabledTimer > 0 ? '120,180,220' : mDef.smokeColor;
            emitTrail(tailX, tailY, m.heading, trailColor);
            m.trailTimer = mDef.trailRate || (CONFIG.trailEmitRate * 1.5);
        }
    }

    // Update player machine gun bullets
    for (const b of state.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) b.alive = false;
    }

    // Camera follow
    updateCamera(dt, player);

    // ── End-of-frame cleanup: filter dead entities ──────
    // alive: false is the only removal mechanism (never splice mid-loop)
    state.missiles = state.missiles.filter(e => e.alive);
    state.obstacles = state.obstacles.filter(e => e.alive);
    state.pickups = state.pickups.filter(e => e.alive);
    state.bullets = state.bullets.filter(e => e.alive);
}

function onPlayerDeath() {
    state.stats.timeSurvived = state.timeAlive;
    state.phase = 'gameover';
}

// ── Render orchestrator ─────────────────────────────────
function render() {
    const w = CONFIG.canvasWidth;
    const h = CONFIG.canvasHeight;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (state.phase === 'title') {
        // Sky background + title overlay
        drawSky(ctx, w, h, 0);
        drawParallax(ctx, { x: Date.now() / 100, y: 0 }, w, h);
        drawTitleScreen(ctx, w, h, state);
        return;
    }

    // ── Sky (base layer) ────────────────────────────────
    drawSky(ctx, w, h, state.timeAlive);

    // ── Parallax background ─────────────────────────────
    drawParallax(ctx, camera, w, h);

    // ── Obstacles ───────────────────────────────────────
    for (const obs of state.obstacles) {
        if (!obs.alive) continue;
        if (!isVisible(obs.x, obs.y, w, h)) continue;
        const sp = worldToScreen(obs.x, obs.y, w, h);
        drawObstacle(obs, ctx, sp);
    }

    // ── Pickups ─────────────────────────────────────────
    for (const pk of state.pickups) {
        if (!pk.alive) continue;
        if (!isVisible(pk.x, pk.y, w, h)) continue;
        const sp = worldToScreen(pk.x, pk.y, w, h);
        drawPickup(pk, ctx, sp);
    }

    // ── Missiles ────────────────────────────────────────
    for (const m of state.missiles) {
        if (!m.alive) continue;
        if (!isVisible(m.x, m.y, w, h)) continue;
        const sp = worldToScreen(m.x, m.y, w, h);
        drawMissile(m, ctx, sp);
    }

    // ── Countermeasure effects ──────────────────────────
    drawCountermeasures(state, ctx, worldToScreen, w, h);

    // ── Machine Gun Bullets ─────────────────────────────
    for (const b of state.bullets) {
        if (!b.alive) continue;
        if (!isVisible(b.x, b.y, w, h)) continue;
        const sp = worldToScreen(b.x, b.y, w, h);
        drawBullet(b, ctx, sp);
    }

    // ── Player ──────────────────────────────────────────
    if (state.player && state.player.alive) {
        const sp = worldToScreen(state.player.x, state.player.y, w, h);
        drawPlayer(state.player, ctx, sp);
    }

    // ── Particles (on top of entities for visibility) ───
    drawParticles(ctx, worldToScreen, w, h);

    // ── HUD (always on top) ─────────────────────────────
    if (state.phase === 'playing') {
        drawHUD(ctx, w, h, state);
    } else if (state.phase === 'gameover') {
        // Still show particles from explosion during game-over
        drawGameOverScreen(ctx, w, h, state.stats);
    }
}

// ── Responsive resize ───────────────────────────────────
function handleResize() {
    // CSS handles the scaling; canvas internal resolution stays fixed
    const aspect = CONFIG.canvasWidth / CONFIG.canvasHeight;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const winAspect = winW / winH;

    if (winAspect > aspect) {
        // Window is wider: letterbox sides
        canvas.style.height = '100vh';
        canvas.style.width = `${winH * aspect}px`;
    } else {
        // Window is taller: letterbox top/bottom
        canvas.style.width = '100vw';
        canvas.style.height = `${winW / aspect}px`;
    }
}

window.addEventListener('resize', handleResize);
handleResize();

// ── Launch ──────────────────────────────────────────────
init();
