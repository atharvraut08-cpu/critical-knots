/**
 * main.js — Game loop bootstrap, orchestrator & Multiplayer integration
 * 
 * Supports both:
 * - Single Player (Survival & Free Flight)
 * - 12-Player 4-Team Tactical Squadron Dogfight (Private rooms, custom team names, team swapping, bots)
 */

import { CONFIG } from './config.js?v=2.4.0';
import state, { reset } from './state.js?v=2.4.0';
import keys, { initInput, consumeAction } from './input.js?v=2.4.0';
import camera, { updateCamera, worldToScreen, isVisible, resetCamera } from './camera.js?v=2.4.0';
import { createPlayer, updatePlayer, drawPlayer, drawBullet } from './entities/player.js?v=2.4.0';
import { updateMissile, drawMissile } from './entities/missile.js?v=2.4.0';
import { drawObstacle } from './entities/obstacle.js?v=2.4.0';
import { updatePickup, drawPickup } from './entities/pickup.js?v=2.4.0';
import { initParticles, updateParticles, drawParticles, emitTrail } from './entities/particle.js?v=2.4.0';
import { checkAllCollisions, checkMultiplayerCollisions, spawnExplosion } from './systems/collision.js?v=2.4.0';
import { updateSpawner, scatterObstacles } from './systems/spawner.js?v=2.4.0';
import { updateCountermeasures, drawCountermeasures } from './systems/countermeasures.js?v=2.4.0';
import { initParallax, drawParallax } from './systems/parallax.js?v=2.4.0';
import { drawSky, drawVignette } from './render/sky.js?v=2.5.1';
import { drawTitleScreen, drawHUD, drawGameOverScreen, drawMultiplayerHUD } from './render/hud.js?v=2.4.0';
import { initLobby, showLobby } from './render/lobby.js?v=2.4.0';
import net from './network/client.js?v=2.4.0';
import { createCombatMissile, updateCombatMissile, drawCombatMissile } from './entities/combatMissile.js?v=2.4.0';
import { createPowerup, updatePowerup, drawPowerup } from './entities/powerups.js?v=2.4.0';
import {
    initAudio,
    updateEngineSound,
    playMissileLaunch,
    updateLockTone,
    playHealthKitChime,
    playShieldChime,
    playBoostChime,
    playHitThud,
    playVictoryFanfare,
    getMuteState,
} from './systems/audio.js?v=2.4.0';

// ── Canvas setup ────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.canvasWidth;
canvas.height = CONFIG.canvasHeight;

// ── Mobile detection ────────────────────────────────────
function checkMobileDevice() {
    const isMobileUA = /Android.*Mobile|iPhone|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
    if (isMobileUA) {
        const msg = document.getElementById('mobileWarning');
        if (msg) msg.style.display = 'flex';
    }
}

// ── Game initialization ─────────────────────────────────
let lastTime = 0;
let netSyncTimer = 0;

function init() {
    checkMobileDevice();

    initInput();
    initParticles();
    initParallax();

    // Initialize multiplayer lobby overlay
    initLobby(onStartGame);

    // Setup network event handlers
    setupNetworkHandlers();

    // Initialize procedural audio synthesizer
    initAudio();

    // Canvas click exit for victory screen
    canvas.addEventListener('click', () => {
        if (state.matchEnded) {
            exitMatchToLobby();
        }
    });

    state.phase = 'lobby';
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

function exitMatchToLobby() {
    state.matchEnded = false;
    state.matchEndData = null;
    net.returnToLobby();
    showLobby();
}

/**
 * Called when starting either a single-player game or a multiplayer match.
 * @param {object|null} roomData - null for single player, room snapshot for multiplayer
 */
function onStartGame(roomData) {
    reset();
    initParticles();
    initParallax();

    if (!roomData) {
        // Single player mode
        state.gameMode = 'survival';
        const player = createPlayer({ name: 'Solo Pilot', team: 0 });
        state.player = player;
        scatterObstacles(state);
        resetCamera(player.x, player.y);
        state.phase = 'playing';
    } else {
        // Multiplayer Squadron Dogfight mode
        state.gameMode = 'multiplayer';
        state.roomData = roomData;
        state.teamScores = roomData.teamScores || [0, 0, 0, 0];

        // Find my player in the room list
        const myData = roomData.players.find(p => p.id === net.playerId);
        const myTeam = myData ? myData.team : 0;
        const myName = myData ? myData.name : 'Commander';

        const player = createPlayer({
            id: net.playerId,
            name: myName,
            team: myTeam,
            x: myData ? myData.x : 0,
            y: myData ? myData.y : 0,
            heading: myData ? myData.heading : -Math.PI / 2,
        });

        state.player = player;

        // Initialize remote players list
        state.remotePlayers = roomData.players
            .filter(p => p.id !== net.playerId)
            .map(p => ({
                id: p.id,
                name: p.name,
                team: p.team,
                x: p.x,
                y: p.y,
                heading: p.heading,
                speed: p.speed,
                health: p.health,
                maxHealth: 100,
                shield: p.shield,
                maxShield: 50,
                radius: CONFIG.playerRadius,
                boosting: p.boosting,
                firingGuns: p.firingGuns,
                missilesReady: p.missilesReady,
                alive: p.alive,
                isBot: p.isBot,
                kills: p.kills,
                deaths: p.deaths,
                score: p.score,
            }));

        // Convert room pickups to powerup entities
        state.pickups = (roomData.pickups || []).map(pk => createPowerup(pk));

        resetCamera(player.x, player.y);
        state.phase = 'playing';
    }
}

function setupNetworkHandlers() {
    // 30Hz Server Snapshot
    net.on('tickUpdate', (msg) => {
        if (state.gameMode !== 'multiplayer' || !state.player) return;

        state.teamScores = msg.teamScores || state.teamScores;

        // Update remote player transforms
        for (const pUpdate of msg.players) {
            if (pUpdate.id === state.player.id) {
                // Update local player authoritative stats from server
                state.player.health = pUpdate.health;
                state.player.shield = pUpdate.shield;
                state.player.missilesReady = pUpdate.missilesReady;
                state.player.alive = pUpdate.alive;
                state.player.kills = pUpdate.kills;
                state.player.deaths = pUpdate.deaths;
                state.player.score = pUpdate.score;
            } else {
                let remote = state.remotePlayers.find(r => r.id === pUpdate.id);
                if (remote) {
                    // Smooth lerp for positions
                    remote.x += (pUpdate.x - remote.x) * 0.45;
                    remote.y += (pUpdate.y - remote.y) * 0.45;
                    remote.heading = pUpdate.heading;
                    remote.speed = pUpdate.speed;
                    remote.health = pUpdate.health;
                    remote.shield = pUpdate.shield;
                    remote.boosting = pUpdate.boosting;
                    remote.firingGuns = pUpdate.firingGuns;
                    remote.missilesReady = pUpdate.missilesReady;
                    remote.alive = pUpdate.alive;
                    remote.kills = pUpdate.kills;
                    remote.deaths = pUpdate.deaths;
                    remote.score = pUpdate.score;
                }
            }
        }

        // Sync pickups
        if (msg.pickups && state.pickups) {
            for (const sPk of msg.pickups) {
                const localPk = state.pickups.find(p => p.id === sPk.id);
                if (localPk) {
                    localPk.alive = sPk.alive;
                    localPk.x = sPk.x;
                    localPk.y = sPk.y;
                }
            }
        }
    });

    // Combat Missile Launched
    net.on('missileFired', (missileData) => {
        if (!state.combatMissiles) state.combatMissiles = [];
        state.combatMissiles.push(createCombatMissile(missileData));
        playMissileLaunch();
    });

    // Damage Taken
    net.on('damageTaken', (msg) => {
        if (state.player && msg.targetId === state.player.id) {
            state.player.health = msg.health;
            state.player.shield = msg.shield;
            // Red flash & camera shake
            state.shakeMagnitude = Math.min(CONFIG.shakeMaxMagnitude, state.shakeMagnitude + 5);
            playHitThud();
        }
    });

    // Player Killed
    net.on('playerKilled', (msg) => {
        if (!state.killFeed) state.killFeed = [];
        state.killFeed.push(msg);

        if (state.player && msg.targetId === state.player.id) {
            state.player.alive = false;
            spawnExplosion(state.player.x, state.player.y, true);
        } else {
            const victim = (state.remotePlayers || []).find(r => r.id === msg.targetId);
            if (victim) {
                victim.alive = false;
                spawnExplosion(victim.x, victim.y, true);
            }
        }
    });

    // Player Respawned
    net.on('playerRespawned', (respawnData) => {
        if (state.player && respawnData.id === state.player.id) {
            state.player.x = respawnData.x;
            state.player.y = respawnData.y;
            state.player.heading = respawnData.heading;
            state.player.health = respawnData.health;
            state.player.shield = respawnData.shield;
            state.player.missilesReady = respawnData.missilesReady;
            state.player.alive = true;
        } else {
            const remote = (state.remotePlayers || []).find(r => r.id === respawnData.id);
            if (remote) {
                remote.x = respawnData.x;
                remote.y = respawnData.y;
                remote.heading = respawnData.heading;
                remote.health = respawnData.health;
                remote.shield = respawnData.shield;
                remote.missilesReady = respawnData.missilesReady;
                remote.alive = true;
            }
        }
    });

    // Pickup Collected
    net.on('pickupCollected', (msg) => {
        if (state.player && msg.playerId === state.player.id) {
            state.player.health = msg.health;
            state.player.shield = msg.shield;
            state.player.missilesReady = msg.missilesReady;

            if (msg.pickupType === 'health') {
                playHealthKitChime();
            } else if (msg.pickupType === 'shield') {
                playShieldChime();
            } else {
                playBoostChime();
            }
        }
    });

    // Match Ended / Victory Screen
    net.on('matchEnded', (msg) => {
        state.matchEnded = true;
        state.matchEndData = msg;
        playVictoryFanfare();
    });
}

// ── Main loop ───────────────────────────────────────────
function loop(timestamp) {
    const rawDt = (timestamp - lastTime) / 1000;
    const dt = Math.min(rawDt, 0.05);
    lastTime = timestamp;

    if (state.phase === 'title') {
        if (consumeAction('start')) {
            showLobby();
        }
    } else if (state.matchEnded) {
        if (consumeAction('restart') || consumeAction('start') || consumeAction('missile')) {
            exitMatchToLobby();
        }
    } else if (state.phase === 'gameover') {
        if (consumeAction('restart') || consumeAction('start')) {
            if (state.gameMode === 'multiplayer') {
                showLobby();
            } else {
                onStartGame(null);
            }
        }
    } else if (state.phase === 'playing') {
        if (consumeAction('pause') && state.gameMode !== 'multiplayer') {
            state.paused = !state.paused;
        }
    }

    if (state.phase === 'playing' && !state.paused) {
        update(dt);
    }

    render();

    requestAnimationFrame(loop);
}

// ── Update orchestrator ─────────────────────────────────
function update(dt) {
    const player = state.player;
    if (!player) return;

    state.timeAlive += dt;

    // ── Procedural Engine Sound & Audio State ───────────
    const maxFlightSpeed = (CONFIG.playerBaseSpeed || 220) * (CONFIG.boostMultiplier || 1.6);
    const speedRatio = player.speed ? (player.speed / maxFlightSpeed) : 0.6;
    updateEngineSound(speedRatio, player.boosting, player.alive);
    state.isMuted = getMuteState();

    // ── Local Player Physics & Controls ─────────────────
    updatePlayer(player, dt, keys);

    // ── Countermeasures (Flares & EMP) ──────────────────
    updateCountermeasures(state, dt, keys);

    if (state.gameMode === 'multiplayer') {
        updateMultiplayer(dt);
    } else {
        updateSinglePlayer(dt);
    }

    // ── Particle system & exhaust trails ────────────────
    updateParticles(dt);

    if (player.alive && player.trailTimer <= 0) {
        const tailX = player.x - Math.cos(player.heading) * player.radius;
        const tailY = player.y - Math.sin(player.heading) * player.radius;
        emitTrail(tailX, tailY, player.heading, player.boosting ? '255,180,50' : '150,180,220');
        player.trailTimer = CONFIG.trailEmitRate;
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

    // Filter dead entities
    state.bullets = state.bullets.filter(e => e.alive);
    if (state.combatMissiles) {
        state.combatMissiles = state.combatMissiles.filter(e => e.alive);
    }
}

function updateSinglePlayer(dt) {
    const player = state.player;

    if (!player.alive) {
        onPlayerDeath();
        return;
    }

    updateSpawner(state, dt, CONFIG.canvasWidth, CONFIG.canvasHeight);

    for (const m of state.missiles) {
        updateMissile(m, dt, player, state.flares, state.timeAlive);
    }

    for (const pk of state.pickups) {
        updatePickup(pk, dt);
    }

    checkAllCollisions(state);

    if (!player.alive) {
        onPlayerDeath();
        return;
    }

    state.missiles = state.missiles.filter(e => e.alive);
    state.obstacles = state.obstacles.filter(e => e.alive);
    state.pickups = state.pickups.filter(e => e.alive);
}

function updateMultiplayer(dt) {
    const player = state.player;

    // ── 1. Target Lock-On Seeker Logic ──────────────────
    const allRemotes = state.remotePlayers || [];
    let bestTarget = null;
    let closestDist = 650; // max lock-on seeker distance

    for (const enemy of allRemotes) {
        if (!enemy.alive || enemy.team === player.team) continue;

        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy);

        if (dist < closestDist) {
            // Check if within nose forward cone (~35 degrees)
            const angleToTarget = Math.atan2(dy, dx);
            let diff = angleToTarget - player.heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            if (Math.abs(diff) < 0.6) {
                closestDist = dist;
                bestTarget = enemy;
            }
        }
    }

    if (bestTarget) {
        player.lockTargetId = bestTarget.id;
        player.lockProgress = Math.min(1.0, (player.lockProgress || 0) + dt / 0.5);
    } else {
        player.lockProgress = Math.max(0, (player.lockProgress || 0) - dt * 2);
        if (player.lockProgress <= 0) {
            player.lockTargetId = null;
        }
    }

    // Audio telemetry lock-on seeker beeps
    updateLockTone(player.lockProgress || 0, !!player.lockTargetId);

    // ── 2. Wing-Mounted Missile Launch ──────────────────
    if (consumeAction('missile')) {
        if (player.alive && player.missilesReady > 0 && player.missileCooldown <= 0) {
            player.missileCooldown = 0.5;
            net.fireMissile(player.lockTargetId, player.x, player.y, player.heading);
            playMissileLaunch();
        }
    }

    // ── 3. High-Frequency Network Position Broadcast ────
    netSyncTimer += dt;
    if (netSyncTimer >= 0.033) {
        netSyncTimer = 0;
        net.sendPlayerUpdate({
            x: player.x,
            y: player.y,
            heading: player.heading,
            speed: player.speed,
            boosting: player.boosting,
            firingGuns: keys.fire,
        });
    }

    // ── 4. Update Combat Missiles ────────────────────────
    const allTargets = [player, ...allRemotes];
    for (const m of (state.combatMissiles || [])) {
        updateCombatMissile(m, dt, allTargets, state.flares);
    }

    // ── 5. Update Health Kits & Boost Crates ─────────────
    for (const pk of (state.pickups || [])) {
        updatePowerup(pk, dt);
    }

    // ── 6. Multiplayer Collision & Damage Arbitration ───
    checkMultiplayerCollisions(state, net);
}

function onPlayerDeath() {
    state.stats.timeSurvived = state.timeAlive;
    state.phase = 'gameover';
}

// ── Render orchestrator ─────────────────────────────────
function render() {
    const w = CONFIG.canvasWidth;
    const h = CONFIG.canvasHeight;

    ctx.clearRect(0, 0, w, h);

    if (state.phase === 'title' || state.phase === 'lobby') {
        drawSky(ctx, w, h, 0);
        drawParallax(ctx, { x: Date.now() / 100, y: 0 }, w, h);
        if (state.phase === 'title') {
            drawTitleScreen(ctx, w, h, state);
        }
        return;
    }

    const player = state.player;

    // ── Sky layer with dynamic altitude grid & clouds ───
    drawSky(ctx, w, h, state.timeAlive, player ? player.boosting : false, player ? player.heading : 0);

    // ── Parallax background ─────────────────────────────
    drawParallax(ctx, camera, w, h);

    // ── Pickups (Health Kits +50 HP & Boosts) ────────────
    for (const pk of state.pickups) {
        if (!pk.alive) continue;
        if (!isVisible(pk.x, pk.y, w, h)) continue;
        const sp = worldToScreen(pk.x, pk.y, w, h);
        if (state.gameMode === 'multiplayer') {
            drawPowerup(pk, ctx, sp);
        } else {
            drawPickup(pk, ctx, sp);
        }
    }

    // ── Obstacles (Single Player) ───────────────────────
    for (const obs of state.obstacles) {
        if (!obs.alive) continue;
        if (!isVisible(obs.x, obs.y, w, h)) continue;
        const sp = worldToScreen(obs.x, obs.y, w, h);
        drawObstacle(obs, ctx, sp);
    }

    // ── Missiles (Single Player) ────────────────────────
    for (const m of state.missiles) {
        if (!m.alive) continue;
        if (!isVisible(m.x, m.y, w, h)) continue;
        const sp = worldToScreen(m.x, m.y, w, h);
        drawMissile(m, ctx, sp);
    }

    // ── Combat Missiles (Multiplayer Wing Missiles) ─────
    if (state.combatMissiles) {
        const teamColors = state.roomData ? state.roomData.teamColors : null;
        for (const cm of state.combatMissiles) {
            if (!cm.alive) continue;
            if (!isVisible(cm.x, cm.y, w, h)) continue;
            const sp = worldToScreen(cm.x, cm.y, w, h);
            drawCombatMissile(cm, ctx, sp, teamColors);
        }
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

    // ── Remote Squadron Jets (Multiplayer) ──────────────
    if (state.gameMode === 'multiplayer' && state.remotePlayers) {
        for (const remote of state.remotePlayers) {
            if (!remote.alive) continue;
            if (!isVisible(remote.x, remote.y, w, h)) continue;
            const sp = worldToScreen(remote.x, remote.y, w, h);
            drawPlayer(remote, ctx, sp);
        }
    }

    // ── Local Player Aircraft ───────────────────────────
    if (player && player.alive) {
        const sp = worldToScreen(player.x, player.y, w, h);
        drawPlayer(player, ctx, sp);
    }

    // ── Particles ───────────────────────────────────────
    drawParticles(ctx, worldToScreen, w, h);

    // ── Cinematic Screen Vignette ───────────────────────
    drawVignette(ctx, w, h);

    // ── HUD Overlay ─────────────────────────────────────
    if (state.phase === 'playing') {
        if (state.gameMode === 'multiplayer') {
            drawMultiplayerHUD(ctx, w, h, state, keys);
        } else {
            drawHUD(ctx, w, h, state);
        }
    } else if (state.phase === 'gameover') {
        drawGameOverScreen(ctx, w, h, state.stats);
    }
}

// ── Responsive resize ───────────────────────────────────
function handleResize() {
    const aspect = CONFIG.canvasWidth / CONFIG.canvasHeight;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const winAspect = winW / winH;

    if (winAspect > aspect) {
        canvas.style.height = '100vh';
        canvas.style.width = `${winH * aspect}px`;
    } else {
        canvas.style.width = '100vw';
        canvas.style.height = `${winW / aspect}px`;
    }
}

window.addEventListener('resize', handleResize);
handleResize();

// ── Launch ──────────────────────────────────────────────
init();
