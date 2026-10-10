/**
 * main.js — Game loop bootstrap and orchestrator
 * 
 * Ties all modules together: canvas setup, RAF loop with dt clamp,
 * game phase management (title → playing → gameover), and the
 * update/render orchestrators that call into each system.
 */

import { CONFIG } from './config.js';
import state, { reset } from './state.js';
import keys, { initInput, consumeAction, suppressAction } from './input.js';
import camera, { updateCamera, worldToScreen, isVisible, resetCamera } from './camera.js';
import { createPlayer, updatePlayer, drawPlayer, drawBullet } from './entities/player.js';
import { updateMissile, drawMissile } from './entities/missile.js';
import { initParticles, updateParticles, drawParticles, emitTrail } from './entities/particle.js';
import { checkAllCollisions } from './systems/collision.js';
import { updateSpawner } from './systems/spawner.js';
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
let gameOverCooldown = 0;

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

    gameOverCooldown = 0;
    const player = createPlayer();
    state.player = player;

    // Reset camera to player position (no lag on start)
    resetCamera(player.x, player.y);

    state.phase = 'playing';
}

/**
 * Return to the main title screen from gameover or paused states.
 * Resets all entities, timers, and pause state cleanly.
 */
function returnToTitle() {
    reset();
    initParticles();
    initParallax();
    resetCamera(0, 0);
    gameOverCooldown = 0;
    state.phase = 'title';
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
        consumeAction('quitToMenu');
        if (consumeAction('start')) {
            startGame();
        }
    } else if (state.phase === 'gameover') {
        if (gameOverCooldown > 0) {
            gameOverCooldown -= dt;
            consumeAction('restart');
            consumeAction('start');
        }

        // Return to title screen on ESC
        if (consumeAction('quitToMenu')) {
            returnToTitle();
        } else if (gameOverCooldown <= 0 && (consumeAction('restart') || consumeAction('start'))) {
            // Debounced restart via Space (or R) — only on game-over screen after debounce cooldown
            startGame();
        }
    } else if (state.phase === 'playing') {
        // Discard any restart/start inputs while playing so held or accidental Space/R presses don't leak into gameover
        consumeAction('restart');
        consumeAction('start');

        // Pause toggle
        if (consumeAction('pause')) {
            state.paused = !state.paused;
        }

        // Return to title screen if paused and ESC is pressed
        if (state.paused) {
            if (consumeAction('quitToMenu')) {
                returnToTitle();
            }
        } else {
            // Clear any unconsumed ESC press during active play so it doesn't linger into pause
            consumeAction('quitToMenu');
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

    // Countermeasures (flares)
    updateCountermeasures(state, dt, keys);

    // Collision detection (centralized in systems/collision.js)
    checkAllCollisions(state);

    // Check if player died from collision
    if (!player.alive || state.phase === 'gameover') {
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
            const trailColor = mDef.smokeColor;
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
    state.bullets = state.bullets.filter(e => e.alive);
}

function onPlayerDeath() {
    if (state.phase !== 'gameover') {
        state.stats.timeSurvived = state.timeAlive;
        state.phase = 'gameover';
    }
    // Strictly debounce and clear restart inputs on the frame of impact
    gameOverCooldown = 0.6;
    consumeAction('restart');
    consumeAction('start');
    suppressAction('restart');
    suppressAction('start');
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
