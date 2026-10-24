/**
 * main.js — Game loop bootstrap and orchestrator
 * 
 * Ties all modules together: canvas setup, RAF loop with dt clamp,
 * game phase management (title → playing → gameover), and the
 * update/render orchestrators that call into each system.
 */

import { CONFIG } from './config.js';
import state, { reset } from './state.js';
import keys, { initInput, consumeAction, suppressAction, consumeMouseClick, mouse } from './input.js';
import camera, { updateCamera, worldToScreen, isVisible, resetCamera } from './camera.js';
import { createPlayer, updatePlayer, drawPlayer } from './entities/player.js';
import { updateBullet, drawBullet } from './entities/bullet.js';
import { createMissile, updateMissile, drawMissile } from './entities/missile.js';
import { initParticles, updateParticles, drawParticles, emitTrail } from './entities/particle.js';
import { checkAllCollisions } from './systems/collision.js';
import { updateSpawner } from './systems/spawner.js';
import { updateCountermeasures, drawCountermeasures } from './systems/countermeasures.js';
import { initParallax, drawParallax } from './systems/parallax.js';
import { drawSky } from './render/sky.js';
import { drawTitleScreen, drawHUD, drawGameOverScreen, getTitleCards } from './render/hud.js';
import { createEnemy, drawEnemy } from './entities/enemy.js';

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
    console.log(`[${CONFIG.gameTitle || 'Critical Knots'}] Engine initialized.`);
    checkMobileDevice();

    initInput(canvas);
    initParticles();
    initParallax();

    state.phase = 'title';
    state.selectedCardIndex = 0;
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

/**
 * Start a new game run.
 * 
 * @param {'survival'|'dogfight'|'flightschool'} [mode='survival']
 */
function startGame(mode = 'survival') {
    // Flight School mode is locked / coming soon — guard against broken state
    if (mode === 'flightschool') {
        mode = 'survival';
    }

    reset(mode);
    initParticles();
    initParallax();

    gameOverCooldown = 0;
    const player = createPlayer();
    state.player = player;

    if (mode === 'dogfight') {
        // Spawn player and 2 enemy AI jets at opposite ends of the map
        player.x = -650;
        player.y = 0;
        player.heading = 0; // facing East towards enemy lines
        player.vx = CONFIG.playerBaseSpeed;
        player.vy = 0;
        player.missiles = CONFIG.playerDogfightMissiles || 6;
        player.maxMissiles = CONFIG.playerDogfightMissiles || 6;

        // Spawn 2 enemy AI jets at the opposite end facing West towards player
        const enemy1 = createEnemy(650, -320, Math.PI, 1);
        const enemy2 = createEnemy(650, 320, Math.PI, 2);
        state.enemies = [enemy1, enemy2];
    } else if (mode === 'flightschool') {
        // Peaceful training airspace without hostile spawns
        player.x = 0;
        player.y = 0;
        player.heading = -Math.PI / 2;
        player.vx = 0;
        player.vy = -CONFIG.playerBaseSpeed;
        player.ammo = CONFIG.maxAmmo || 500;
        player.missiles = 6;
        state.enemies = [];
        state.missiles = [];
    }

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

    // Manage mouse cursor visibility
    let isOverLockedCard = false;
    if (state.phase === 'title') {
        const cards = getTitleCards(CONFIG.canvasWidth, CONFIG.canvasHeight);
        for (const card of cards) {
            if (card.locked && mouse.x >= card.x && mouse.x <= card.x + card.w &&
                mouse.y >= card.y && mouse.y <= card.y + card.h) {
                isOverLockedCard = true;
                break;
            }
        }
    }
    canvas.style.cursor = state.phase === 'title' ? (isOverLockedCard ? 'not-allowed' : 'pointer') : (state.paused ? 'default' : 'none');

    // ── Phase-specific input handling ───────────────────
    if (state.phase === 'title') {
        consumeAction('quitToMenu');

        // 1. Keyboard Arrow / Navigation Cycling (cycles only between active cards 0 and 1)
        if (consumeAction('selectPrev')) {
            state.selectedCardIndex = (state.selectedCardIndex === 1) ? 0 : 1;
        }
        if (consumeAction('selectNext')) {
            state.selectedCardIndex = (state.selectedCardIndex === 0) ? 1 : 0;
        }
        // Safety clamp: Flight School (index 2) is locked
        if (state.selectedCardIndex !== 0 && state.selectedCardIndex !== 1) {
            state.selectedCardIndex = 0;
        }

        // 2. Direct Hotkeys [1], [2] (Flight School [3] is locked)
        if (consumeAction('selectCard1')) {
            startGame('survival');
        } else if (consumeAction('selectCard2') || consumeAction('dogfight')) {
            startGame('dogfight');
        } else if (consumeAction('selectCard3')) {
            // Incomplete Flight School mode is locked / coming soon — ignore key action
        } else if (consumeAction('start') || consumeAction('confirm')) {
            const modes = ['survival', 'dogfight'];
            startGame(modes[state.selectedCardIndex] || 'survival');
        }

        // 3. Mouse Click on Cards
        const click = consumeMouseClick();
        if (click) {
            const cards = getTitleCards(CONFIG.canvasWidth, CONFIG.canvasHeight);
            for (const card of cards) {
                if (click.x >= card.x && click.x <= card.x + card.w &&
                    click.y >= card.y && click.y <= card.y + card.h) {
                    if (card.locked || card.mode === 'flightschool') {
                        break; // Locked card — cannot click or trigger
                    }
                    startGame(card.mode);
                    break;
                }
            }
        }

    } else if (state.phase === 'gameover') {
        if (gameOverCooldown > 0) {
            gameOverCooldown -= dt;
            consumeAction('restart');
            consumeAction('start');
            consumeAction('dogfight');
            consumeAction('selectCard1');
            consumeAction('selectCard2');
            consumeAction('selectCard3');
        }

        // Return to title screen on ESC
        if (consumeAction('quitToMenu')) {
            returnToTitle();
        } else if (gameOverCooldown <= 0) {
            if (consumeAction('selectCard1')) {
                startGame('survival');
            } else if (consumeAction('selectCard2') || consumeAction('dogfight')) {
                startGame('dogfight');
            } else if (consumeAction('selectCard3')) {
                // Incomplete Flight School mode is locked — ignore key action
            } else if (consumeAction('restart') || consumeAction('start') || consumeAction('confirm')) {
                // Debounced restart via Space (or R) — restarts current active mode
                const restartMode = state.gameMode === 'flightschool' ? 'survival' : (state.gameMode || 'survival');
                startGame(restartMode);
            }
        }
    } else if (state.phase === 'playing') {
        // Discard any restart/start/dogfight inputs while playing so held keys don't leak into gameover
        consumeAction('restart');
        consumeAction('start');
        consumeAction('dogfight');
        consumeAction('selectCard1');
        consumeAction('selectCard2');
        consumeAction('selectCard3');

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

/**
 * Evaluate Flight School tutorial maneuver progress and handle practice drone spawning.
 * @param {object} state
 * @param {number} dt
 * @param {object} keys
 */
function updateFlightSchoolDrills(state, dt, keys) {
    const player = state.player;
    if (!player) return;
    const fs = state.flightSchool;

    if (fs.feedbackTimer > 0) {
        fs.feedbackTimer -= dt;
    }

    // 1. Aerodynamic Drift Detection
    // Requires sideslip angle |driftAngle| > 18° (0.31 rad) at forward speed > 180 px/s
    if (!fs.driftDone) {
        if (Math.abs(player.driftAngle) > 0.31 && player.speed > 180) {
            fs.driftDone = true;
            fs.feedbackMessage = 'AERODYNAMIC DRIFT MASTERED!';
            fs.feedbackTimer = 3.0;
        }
    }

    // 2. High-G Break Turn Detection
    // Requires high G-force > 2.8 G at speed > 190 px/s
    if (!fs.breakTurnDone) {
        if (player.gForce > 2.8 && player.speed > 190 && player.isTurning) {
            fs.breakTurnDone = true;
            fs.feedbackMessage = 'HIGH-G BREAK TURN MASTERED!';
            fs.feedbackTimer = 3.0;
        }
    }

    // 3. Lateral Dash Roll Detection
    if (!fs.dashDone) {
        if (player.rollTimer > 0) {
            fs.dashDone = true;
            fs.feedbackMessage = 'LATERAL DASH ROLL MASTERED!';
            fs.feedbackTimer = 3.0;
        }
    }

    // 4. Flat Scissors Reversal Detection
    // Requires alternating direction switches in rapid succession (< 1.3s between switches)
    if (!fs.scissorsDone) {
        let turnSign = 0;
        if (keys.left) turnSign = -1;
        else if (keys.right) turnSign = 1;

        if (turnSign !== 0) {
            if (fs.lastTurnSign !== 0 && turnSign !== fs.lastTurnSign) {
                const timeSinceLastSwitch = state.timeAlive - fs.lastTurnSwitchTime;
                if (timeSinceLastSwitch > 0.12 && timeSinceLastSwitch < 1.3) {
                    fs.scissorsCount = (fs.scissorsCount || 0) + 1;
                    if (fs.scissorsCount >= 3) {
                        fs.scissorsDone = true;
                        fs.feedbackMessage = 'FLAT SCISSORS REVERSAL MASTERED!';
                        fs.feedbackTimer = 3.5;
                    }
                }
                fs.lastTurnSwitchTime = state.timeAlive;
            }
            fs.lastTurnSign = turnSign;
        }
    }

    // Practice target drone spawn with [T] key
    if (consumeAction('spawnDrone') || keys.spawnDrone) {
        keys.spawnDrone = false;
        const distAhead = 380;
        const droneX = player.x + Math.cos(player.heading) * distAhead;
        const droneY = player.y + Math.sin(player.heading) * distAhead;
        const droneHeading = player.heading + 0.35;
        const drone = createEnemy(droneX, droneY, droneHeading, 'DRONE', true);
        state.enemies = [drone];
        fs.droneSpawned = true;
        fs.feedbackMessage = 'TARGET DRONE DEPLOYED — PRACTICE LOCK-ON [X] & GUNNERY [C]';
        fs.feedbackTimer = 3.5;
    }

    // Practice missile evasion spawn with [Y] key (800px directly behind player)
    if (consumeAction('spawnMissile') || keys.spawnMissile) {
        keys.spawnMissile = false;
        const spawnDist = 800;
        const tailAngle = player.heading + Math.PI;
        const mx = player.x + Math.cos(tailAngle) * spawnDist;
        const my = player.y + Math.sin(tailAngle) * spawnDist;
        const missileHeading = player.heading;
        const missile = createMissile(mx, my, missileHeading, 'basic', 'enemy', player);
        state.missiles.push(missile);
        fs.feedbackMessage = 'HEAT-SEEKER INBOUND (800PX BEHIND) — BREAK OR POP FLARE [Q]!';
        fs.feedbackTimer = 3.5;
    }
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

    // Spawner and Enemy AI logic by game mode
    if (state.gameMode === 'dogfight') {
        // Dogfight Mode: update Enemy AI jets
        if (state.enemies && state.enemies.length > 0) {
            for (const enemy of state.enemies) {
                enemy.update(dt, player, state.missiles, state.flares, state);
            }
        }
    } else if (state.gameMode === 'flightschool') {
        // Flight School Mode: evaluate maneuvers and update practice drone if present
        updateFlightSchoolDrills(state, dt, keys);

        if (state.enemies && state.enemies.length > 0) {
            for (const enemy of state.enemies) {
                enemy.update(dt, player, state.missiles, state.flares, state);
            }
        }
    } else {
        // Survival Mode: spawn missiles & pickups
        updateSpawner(state, dt, CONFIG.canvasWidth, CONFIG.canvasHeight);
    }

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
            const mDef = CONFIG.missileTypes[m.type] || CONFIG.missileTypes.basic || CONFIG.missileTypes.standard;
            const trailColor = mDef.smokeColor;
            emitTrail(tailX, tailY, m.heading, trailColor);
            m.trailTimer = mDef.trailRate || (CONFIG.trailEmitRate * 1.5);
        }
    }

    // Update player machine gun bullets with Newtonian kinetic drag
    for (const b of state.bullets) {
        updateBullet(b, dt);
    }

    // Camera follow
    updateCamera(dt, player);

    // ── End-of-frame cleanup: filter dead entities ──────
    // Missiles should only be deleted if they are at least 2000 pixels outside the current camera view
    const cullMargin = CONFIG.missileCullMargin || 2000;
    const halfW = CONFIG.canvasWidth / 2;
    const halfH = CONFIG.canvasHeight / 2;
    const cullLeft = camera.x - halfW - cullMargin;
    const cullRight = camera.x + halfW + cullMargin;
    const cullTop = camera.y - halfH - cullMargin;
    const cullBottom = camera.y + halfH + cullMargin;

    for (let i = 0; i < state.missiles.length; i++) {
        const m = state.missiles[i];
        if (!m.alive) continue;
        if (m.x < cullLeft || m.x > cullRight || m.y < cullTop || m.y > cullBottom) {
            m.alive = false;
        }
    }

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
    consumeAction('dogfight');
    suppressAction('restart');
    suppressAction('start');
    suppressAction('dogfight');
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

    // ── Enemy AI Jets (Dogfight Mode) ───────────────────
    if (state.enemies && state.enemies.length > 0) {
        for (const enemy of state.enemies) {
            if (!enemy.alive) continue;
            if (!isVisible(enemy.x, enemy.y, w, h)) continue;
            const sp = worldToScreen(enemy.x, enemy.y, w, h);
            drawEnemy(enemy, ctx, sp);
        }
    }

    // ── Particles (on top of entities for visibility) ───
    drawParticles(ctx, worldToScreen, w, h);

    // ── HUD (always on top) ─────────────────────────────
    if (state.phase === 'playing') {
        drawHUD(ctx, w, h, state);
    } else if (state.phase === 'gameover') {
        // Still show particles from explosion during game-over
        drawGameOverScreen(ctx, w, h, state.stats, state);
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
