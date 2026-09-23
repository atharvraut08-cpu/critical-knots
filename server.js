/**
 * server.js — Unified HTTP static server & WebSocket Multiplayer Room Manager
 * 
 * Features:
 * - Serves static game files (HTML, JS ES modules, CSS)
 * - WebSocket server for real-time 12-player 4-team dogfight matches
 * - Private room creation with 6-character codes
 * - Team switching (4 teams, 3 players each = 12 max)
 * - Custom team naming
 * - Optional tactical AI bot backfill for solo & squad testing
 * - Authoritative pickup spawns (Health kits +50 HP, Boost pods)
 * - Kill feed, damage sync, team scores
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;

// ── MIME types for static file serving ──────────────────────
const MIME_TYPES = {
    '.html': 'text/html; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
};

// ── HTTP Static Server ──────────────────────────────────────
const server = http.createServer((req, res) => {
    let cleanUrl = req.url.split('?')[0];
    if (cleanUrl === '/' || cleanUrl === '') {
        cleanUrl = '/index.html';
    }

    const filePath = path.join(__dirname, cleanUrl);

    // Prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error');
            }
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(data);
    });
});

// ── Multiplayer Room & State Manager ────────────────────────
const wss = new WebSocketServer({ server });

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} name
 * @property {number} team - 0..3
 * @property {boolean} isHost
 * @property {boolean} isReady
 * @property {boolean} isBot
 * @property {WebSocket|null} ws
 * @property {number} x
 * @property {number} y
 * @property {number} heading
 * @property {number} speed
 * @property {number} health
 * @property {number} maxHealth
 * @property {number} shield
 * @property {boolean} boosting
 * @property {boolean} firingGuns
 * @property {number} missilesReady
 * @property {boolean} alive
 * @property {number} kills
 * @property {number} deaths
 * @property {number} score
 */

/**
 * @typedef {Object} Room
 * @property {string} code
 * @property {string} hostId
 * @property {'lobby'|'playing'|'ended'} state
 * @property {string[]} teamNames
 * @property {string[]} teamColors
 * @property {number[]} teamScores
 * @property {Map<string, Player>} players
 * @property {any[]} pickups
 * @property {any[]} missiles
 * @property {any[]} killFeed
 * @property {NodeJS.Timeout|null} tickInterval
 * @property {number} matchTime
 */

const rooms = new Map();

const DEFAULT_TEAM_NAMES = [
    'Crimson Vanguard',
    'Cobalt Phantoms',
    'Emerald Vipers',
    'Solar Strikers',
];

const TEAM_COLORS = [
    '#ff3b30', // Team 0 - Crimson
    '#007aff', // Team 1 - Cobalt
    '#34c759', // Team 2 - Emerald
    '#ff9500', // Team 3 - Solar
];

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function broadcastToRoom(room, message, excludeWs = null) {
    const payload = JSON.stringify(message);
    for (const player of room.players.values()) {
        if (player.ws && player.ws.readyState === WebSocket.OPEN && player.ws !== excludeWs) {
            player.ws.send(payload);
        }
    }
}

function getRoomSnapshot(room) {
    const playersList = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        isHost: p.isHost,
        isReady: p.isReady,
        isBot: p.isBot,
        x: p.x,
        y: p.y,
        heading: p.heading,
        speed: p.speed,
        health: p.health,
        maxHealth: p.maxHealth,
        shield: p.shield,
        boosting: p.boosting,
        firingGuns: p.firingGuns,
        missilesReady: p.missilesReady,
        alive: p.alive,
        kills: p.kills,
        deaths: p.deaths,
        score: p.score,
    }));

    return {
        code: room.code,
        hostId: room.hostId,
        state: room.state,
        teamNames: room.teamNames,
        teamColors: room.teamColors,
        teamScores: room.teamScores,
        players: playersList,
        pickups: room.pickups,
        matchTime: room.matchTime,
    };
}

function spawnPickups(room) {
    room.pickups = [];
    const types = ['health', 'shield', 'boost', 'missile', 'health', 'health'];
    const count = 12;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 500 + Math.random() * 1400;
        room.pickups.push({
            id: `pk_${i}_${Date.now()}`,
            type: types[i % types.length],
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist,
            amount: 50, // +50 health or shield
            alive: true,
            respawnTimer: 0,
        });
    }
}

function getTeamSpawnPoint(teamIndex, slotIndex) {
    // 4 cardinal quadrants for the 4 teams
    const teamAngles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];
    const baseAngle = teamAngles[teamIndex % 4];
    const dist = 1200;
    const spread = (slotIndex - 1) * 120; // 3 players per team arranged side-by-side
    const cx = Math.cos(baseAngle) * dist;
    const cy = Math.sin(baseAngle) * dist;

    // Perpendicular vector for slot spread
    const perpX = -Math.sin(baseAngle) * spread;
    const perpY = Math.cos(baseAngle) * spread;

    // Face towards center (0,0)
    const heading = Math.atan2(-cy, -cx);

    return { x: cx + perpX, y: cy + perpY, heading };
}

function startRoomGame(room, fillBots = false) {
    room.state = 'playing';
    room.matchTime = 0;
    room.teamScores = [0, 0, 0, 0];
    room.missiles = [];
    room.killFeed = [];

    // Fill empty slots with bots if requested or needed
    if (fillBots) {
        const teamCounts = [0, 0, 0, 0];
        for (const p of room.players.values()) {
            if (p.team >= 0 && p.team < 4) teamCounts[p.team]++;
        }

        let botIndex = 1;
        for (let t = 0; t < 4; t++) {
            while (teamCounts[t] < 3) {
                const botId = `bot_${t}_${teamCounts[t]}_${Date.now()}`;
                const botName = `Ghost-${botIndex++} [BOT]`;
                room.players.set(botId, {
                    id: botId,
                    name: botName,
                    team: t,
                    isHost: false,
                    isReady: true,
                    isBot: true,
                    ws: null,
                    x: 0,
                    y: 0,
                    heading: 0,
                    speed: 220,
                    health: 100,
                    maxHealth: 100,
                    shield: 0,
                    boosting: false,
                    firingGuns: false,
                    missilesReady: 2,
                    alive: true,
                    kills: 0,
                    deaths: 0,
                    score: 0,
                    // Bot AI state
                    botTargetId: null,
                    botFireTimer: 1.5 + Math.random() * 2,
                    botTurnTimer: 0,
                });
                teamCounts[t]++;
            }
        }
    }

    // Set initial spawn coordinates per team
    const teamSlots = [0, 0, 0, 0];
    for (const p of room.players.values()) {
        const slot = teamSlots[p.team] || 0;
        const spawn = getTeamSpawnPoint(p.team, slot);
        p.x = spawn.x;
        p.y = spawn.y;
        p.heading = spawn.heading;
        p.speed = 220;
        p.health = 100;
        p.maxHealth = 100;
        p.shield = 0;
        p.boosting = false;
        p.firingGuns = false;
        p.missilesReady = 2;
        p.alive = true;
        teamSlots[p.team]++;
    }

    spawnPickups(room);

    broadcastToRoom(room, {
        type: 'GAME_STARTED',
        room: getRoomSnapshot(room),
    });

    // Start 30Hz game loop for this room
    if (room.tickInterval) clearInterval(room.tickInterval);
    room.tickInterval = setInterval(() => {
        updateRoomTick(room);
    }, 33);
}

function updateRoomTick(room) {
    if (room.state !== 'playing') return;

    const dt = 0.033;
    room.matchTime += dt;

    // ── Update AI Bots ──────────────────────────────────────
    const allPlayers = Array.from(room.players.values());
    for (const bot of allPlayers) {
        if (!bot.isBot || !bot.alive) continue;

        // Find closest enemy
        let closestEnemy = null;
        let minDist = Infinity;
        for (const other of allPlayers) {
            if (other.id !== bot.id && other.alive && other.team !== bot.team) {
                const dist = Math.hypot(other.x - bot.x, other.y - bot.y);
                if (dist < minDist) {
                    minDist = dist;
                    closestEnemy = other;
                }
            }
        }

        // Steer towards enemy or evade
        if (closestEnemy) {
            const targetAngle = Math.atan2(closestEnemy.y - bot.y, closestEnemy.x - bot.x);
            let diff = targetAngle - bot.heading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            bot.heading += Math.max(-2.0 * dt, Math.min(2.0 * dt, diff));

            // Boost if far
            bot.boosting = minDist > 600;

            // Fire guns if aligned and in range
            bot.firingGuns = Math.abs(diff) < 0.3 && minDist < 700;

            // Fire missile if locked
            bot.botFireTimer -= dt;
            if (bot.botFireTimer <= 0 && bot.missilesReady > 0 && Math.abs(diff) < 0.4 && minDist < 650) {
                bot.botFireTimer = 4.0 + Math.random() * 3;
                bot.missilesReady--;
                const missileId = `msl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                broadcastToRoom(room, {
                    type: 'MISSILE_FIRED',
                    missile: {
                        id: missileId,
                        ownerId: bot.id,
                        ownerTeam: bot.team,
                        targetId: closestEnemy.id,
                        x: bot.x,
                        y: bot.y,
                        heading: bot.heading,
                        speed: 360,
                    },
                });
            }
        }

        // Bot kinematics
        const speed = bot.boosting ? 350 : 220;
        bot.speed = speed;
        bot.x += Math.cos(bot.heading) * speed * dt;
        bot.y += Math.sin(bot.heading) * speed * dt;
    }

    // ── Update Pickups respawn ──────────────────────────────
    for (const pk of room.pickups) {
        if (!pk.alive) {
            pk.respawnTimer -= dt;
            if (pk.respawnTimer <= 0) {
                pk.alive = true;
                pk.x = (Math.random() - 0.5) * 3000;
                pk.y = (Math.random() - 0.5) * 3000;
            }
        }
    }

    // Check match time limit (5 minutes)
    if (room.matchTime >= 300 && room.state === 'playing') {
        let maxScore = -1;
        let bestTeam = 0;
        for (let t = 0; t < 4; t++) {
            if (room.teamScores[t] > maxScore) {
                maxScore = room.teamScores[t];
                bestTeam = t;
            }
        }
        endMatch(room, bestTeam);
        return;
    }

    // Broadcast tick snapshot
    broadcastToRoom(room, {
        type: 'TICK_UPDATE',
        players: allPlayers.map(p => ({
            id: p.id,
            x: p.x,
            y: p.y,
            heading: p.heading,
            speed: p.speed,
            health: p.health,
            shield: p.shield,
            boosting: p.boosting,
            firingGuns: p.firingGuns,
            missilesReady: p.missilesReady,
            alive: p.alive,
            kills: p.kills,
            deaths: p.deaths,
            score: p.score,
        })),
        teamScores: room.teamScores,
        pickups: room.pickups,
    });
}

function endMatch(room, winnerTeam) {
    if (room.state === 'ended') return;
    room.state = 'ended';
    if (room.tickInterval) {
        clearInterval(room.tickInterval);
        room.tickInterval = null;
    }
    broadcastToRoom(room, {
        type: 'MATCH_ENDED',
        winnerTeam: winnerTeam,
        winnerTeamName: room.teamNames[winnerTeam],
        winnerColor: room.teamColors[winnerTeam],
        teamScores: room.teamScores,
        players: Array.from(room.players.values()).map(p => ({
            id: p.id,
            name: p.name,
            team: p.team,
            kills: p.kills,
            deaths: p.deaths,
            score: p.score,
        })),
    });
}

// ── WebSocket Connection Handler ────────────────────────────
wss.on('connection', (ws) => {
    let currentRoom = null;
    let playerId = null;

    ws.on('message', (rawData) => {
        let msg;
        try {
            msg = JSON.parse(rawData);
        } catch (e) {
            return;
        }

        switch (msg.type) {
            // ── 1. Create Room ──────────────────────────────
            case 'CREATE_ROOM': {
                let code = generateRoomCode();
                while (rooms.has(code)) {
                    code = generateRoomCode();
                }

                playerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                const playerName = (msg.playerName || 'Commander').substring(0, 16);

                const newRoom = {
                    code,
                    hostId: playerId,
                    state: 'lobby',
                    teamNames: [...DEFAULT_TEAM_NAMES],
                    teamColors: [...TEAM_COLORS],
                    teamScores: [0, 0, 0, 0],
                    players: new Map(),
                    pickups: [],
                    missiles: [],
                    killFeed: [],
                    tickInterval: null,
                    matchTime: 0,
                };

                const hostPlayer = {
                    id: playerId,
                    name: playerName,
                    team: 0, // Starts in Team 0
                    isHost: true,
                    isReady: true,
                    isBot: false,
                    ws,
                    x: 0,
                    y: 0,
                    heading: 0,
                    speed: 220,
                    health: 100,
                    maxHealth: 100,
                    shield: 0,
                    boosting: false,
                    firingGuns: false,
                    missilesReady: 2,
                    alive: true,
                    kills: 0,
                    deaths: 0,
                    score: 0,
                };

                newRoom.players.set(playerId, hostPlayer);
                rooms.set(code, newRoom);
                currentRoom = newRoom;

                ws.send(JSON.stringify({
                    type: 'ROOM_JOINED',
                    playerId,
                    room: getRoomSnapshot(newRoom),
                }));
                break;
            }

            // ── 2. Join Room ────────────────────────────────
            case 'JOIN_ROOM': {
                const code = (msg.code || '').trim().toUpperCase();
                const room = rooms.get(code);

                if (!room) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found.' }));
                    return;
                }

                if (room.players.size >= 12) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full (12 players max).' }));
                    return;
                }

                playerId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                const playerName = (msg.playerName || `Pilot-${room.players.size + 1}`).substring(0, 16);

                // Find team with least players (< 3)
                const teamCounts = [0, 0, 0, 0];
                for (const p of room.players.values()) {
                    if (p.team >= 0 && p.team < 4) teamCounts[p.team]++;
                }
                let assignedTeam = 0;
                let minCount = Infinity;
                for (let t = 0; t < 4; t++) {
                    if (teamCounts[t] < minCount && teamCounts[t] < 3) {
                        minCount = teamCounts[t];
                        assignedTeam = t;
                    }
                }

                const player = {
                    id: playerId,
                    name: playerName,
                    team: assignedTeam,
                    isHost: false,
                    isReady: false,
                    isBot: false,
                    ws,
                    x: 0,
                    y: 0,
                    heading: 0,
                    speed: 220,
                    health: 100,
                    maxHealth: 100,
                    shield: 0,
                    boosting: false,
                    firingGuns: false,
                    missilesReady: 2,
                    alive: true,
                    kills: 0,
                    deaths: 0,
                    score: 0,
                };

                room.players.set(playerId, player);
                currentRoom = room;

                ws.send(JSON.stringify({
                    type: 'ROOM_JOINED',
                    playerId,
                    room: getRoomSnapshot(room),
                }));

                broadcastToRoom(room, {
                    type: 'ROOM_UPDATE',
                    room: getRoomSnapshot(room),
                }, ws);
                break;
            }

            // ── 3. Switch Team ──────────────────────────────
            case 'SWITCH_TEAM': {
                if (!currentRoom || !playerId) return;
                const player = currentRoom.players.get(playerId);
                if (!player) return;

                const targetTeam = parseInt(msg.team, 10);
                if (targetTeam < 0 || targetTeam > 3) return;

                // Check team capacity (3 max)
                let count = 0;
                for (const p of currentRoom.players.values()) {
                    if (p.team === targetTeam && p.id !== playerId) count++;
                }

                if (count >= 3) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Team is full (3 players max).' }));
                    return;
                }

                player.team = targetTeam;
                broadcastToRoom(currentRoom, {
                    type: 'ROOM_UPDATE',
                    room: getRoomSnapshot(currentRoom),
                });
                break;
            }

            // ── 4. Set Team Name ────────────────────────────
            case 'SET_TEAM_NAME': {
                if (!currentRoom) return;
                const teamIdx = parseInt(msg.team, 10);
                const newName = (msg.name || '').trim().substring(0, 20);
                if (teamIdx >= 0 && teamIdx <= 3 && newName.length > 0) {
                    currentRoom.teamNames[teamIdx] = newName;
                    broadcastToRoom(currentRoom, {
                        type: 'ROOM_UPDATE',
                        room: getRoomSnapshot(currentRoom),
                    });
                }
                break;
            }

            // ── 5. Set Player Name ──────────────────────────
            case 'SET_PLAYER_NAME': {
                if (!currentRoom || !playerId) return;
                const player = currentRoom.players.get(playerId);
                if (player) {
                    player.name = (msg.name || player.name).trim().substring(0, 16);
                    broadcastToRoom(currentRoom, {
                        type: 'ROOM_UPDATE',
                        room: getRoomSnapshot(currentRoom),
                    });
                }
                break;
            }

            // ── 6. Toggle Ready ─────────────────────────────
            case 'TOGGLE_READY': {
                if (!currentRoom || !playerId) return;
                const player = currentRoom.players.get(playerId);
                if (player) {
                    player.isReady = !player.isReady;
                    broadcastToRoom(currentRoom, {
                        type: 'ROOM_UPDATE',
                        room: getRoomSnapshot(currentRoom),
                    });
                }
                break;
            }

            // ── 7. Start Match ──────────────────────────────
            case 'START_MATCH': {
                if (!currentRoom || !playerId) return;
                const player = currentRoom.players.get(playerId);
                if (!player || !player.isHost) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'Only the host can start the match.' }));
                    return;
                }

                startRoomGame(currentRoom, !!msg.fillBots);
                break;
            }

            // ── 8. Player Transform / In-Game Input ─────────
            case 'PLAYER_UPDATE': {
                if (!currentRoom || !playerId || currentRoom.state !== 'playing') return;
                const player = currentRoom.players.get(playerId);
                if (!player || !player.alive) return;

                player.x = msg.x;
                player.y = msg.y;
                player.heading = msg.heading;
                player.speed = msg.speed;
                player.boosting = !!msg.boosting;
                player.firingGuns = !!msg.firingGuns;
                break;
            }

            // ── 9. Fire Wing Missile ────────────────────────
            case 'FIRE_MISSILE': {
                if (!currentRoom || !playerId || currentRoom.state !== 'playing') return;
                const player = currentRoom.players.get(playerId);
                if (!player || !player.alive || player.missilesReady <= 0) return;

                player.missilesReady--;
                const missileId = `msl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

                broadcastToRoom(currentRoom, {
                    type: 'MISSILE_FIRED',
                    missile: {
                        id: missileId,
                        ownerId: player.id,
                        ownerTeam: player.team,
                        targetId: msg.targetId || null,
                        x: msg.x || player.x,
                        y: msg.y || player.y,
                        heading: msg.heading ?? player.heading,
                        speed: 380,
                    },
                });
                break;
            }

            // ── 10. Damage & Health arbitration ─────────────
            case 'PLAYER_HIT': {
                if (!currentRoom || !playerId || currentRoom.state !== 'playing') return;
                const targetPlayer = currentRoom.players.get(msg.targetId);
                const attacker = currentRoom.players.get(playerId);

                if (!targetPlayer || !targetPlayer.alive) return;
                // Friendly fire immunity
                if (attacker && attacker.team === targetPlayer.team) return;

                const damage = Math.min(100, Math.max(1, msg.damage || 10));

                // Shield absorbs damage first
                if (targetPlayer.shield > 0) {
                    if (targetPlayer.shield >= damage) {
                        targetPlayer.shield -= damage;
                    } else {
                        const leftover = damage - targetPlayer.shield;
                        targetPlayer.shield = 0;
                        targetPlayer.health = Math.max(0, targetPlayer.health - leftover);
                    }
                } else {
                    targetPlayer.health = Math.max(0, targetPlayer.health - damage);
                }

                if (targetPlayer.health <= 0) {
                    targetPlayer.alive = false;
                    targetPlayer.deaths++;
                    if (attacker) {
                        attacker.kills++;
                        attacker.score += 100;
                        currentRoom.teamScores[attacker.team] += 100;

                        // Check victory threshold (500 pts = 5 kills)
                        if (currentRoom.teamScores[attacker.team] >= 500) {
                            broadcastToRoom(currentRoom, {
                                type: 'PLAYER_KILLED',
                                targetId: targetPlayer.id,
                                targetName: targetPlayer.name,
                                targetTeam: targetPlayer.team,
                                killerId: attacker.id,
                                killerName: attacker.name,
                                killerTeam: attacker.team,
                                weapon: msg.weapon || 'Gunfire',
                                teamScores: currentRoom.teamScores,
                            });
                            endMatch(currentRoom, attacker.team);
                            return;
                        }
                    }

                    broadcastToRoom(currentRoom, {
                        type: 'PLAYER_KILLED',
                        targetId: targetPlayer.id,
                        targetName: targetPlayer.name,
                        targetTeam: targetPlayer.team,
                        killerId: attacker ? attacker.id : null,
                        killerName: attacker ? attacker.name : 'Environmental Hazard',
                        killerTeam: attacker ? attacker.team : -1,
                        weapon: msg.weapon || 'Gunfire',
                        teamScores: currentRoom.teamScores,
                    });

                    // Respawn after 4 seconds
                    setTimeout(() => {
                        if (currentRoom && currentRoom.state === 'playing') {
                            const slot = Math.floor(Math.random() * 3);
                            const spawn = getTeamSpawnPoint(targetPlayer.team, slot);
                            targetPlayer.x = spawn.x;
                            targetPlayer.y = spawn.y;
                            targetPlayer.heading = spawn.heading;
                            targetPlayer.health = 100;
                            targetPlayer.shield = 0;
                            targetPlayer.missilesReady = 2;
                            targetPlayer.alive = true;

                            broadcastToRoom(currentRoom, {
                                type: 'PLAYER_RESPAWNED',
                                player: {
                                    id: targetPlayer.id,
                                    x: targetPlayer.x,
                                    y: targetPlayer.y,
                                    heading: targetPlayer.heading,
                                    health: 100,
                                    shield: 0,
                                    missilesReady: 2,
                                    alive: true,
                                },
                            });
                        }
                    }, 4000);
                } else {
                    broadcastToRoom(currentRoom, {
                        type: 'DAMAGE_TAKEN',
                        targetId: targetPlayer.id,
                        health: targetPlayer.health,
                        shield: targetPlayer.shield,
                    });
                }
                break;
            }

            // ── 11. Collect Health Kit / Boost Crate ────────
            case 'COLLECT_PICKUP': {
                if (!currentRoom || !playerId || currentRoom.state !== 'playing') return;
                const player = currentRoom.players.get(playerId);
                if (!player || !player.alive) return;

                const pickup = currentRoom.pickups.find(p => p.id === msg.pickupId && p.alive);
                if (!pickup) return;

                pickup.alive = false;
                pickup.respawnTimer = 18; // 18s respawn

                // Apply bonus
                if (pickup.type === 'health') {
                    // +50 health increase (up to 100 max)
                    player.health = Math.min(100, player.health + 50);
                } else if (pickup.type === 'shield') {
                    player.shield = Math.min(50, player.shield + 50);
                } else if (pickup.type === 'missile') {
                    player.missilesReady = Math.min(4, player.missilesReady + 2);
                }

                broadcastToRoom(currentRoom, {
                    type: 'PICKUP_COLLECTED',
                    playerId: player.id,
                    pickupId: pickup.id,
                    pickupType: pickup.type,
                    health: player.health,
                    shield: player.shield,
                    missilesReady: player.missilesReady,
                });
                break;
            }

            // ── 12. Return to Room Lobby ────────────────────
            case 'RETURN_TO_LOBBY': {
                if (!currentRoom) return;
                currentRoom.state = 'lobby';
                if (currentRoom.tickInterval) {
                    clearInterval(currentRoom.tickInterval);
                    currentRoom.tickInterval = null;
                }
                currentRoom.teamScores = [0, 0, 0, 0];
                currentRoom.matchTime = 0;
                for (const p of currentRoom.players.values()) {
                    p.kills = 0;
                    p.deaths = 0;
                    p.score = 0;
                    p.health = 100;
                    p.shield = 0;
                    p.missilesReady = 2;
                    p.alive = true;
                }
                broadcastToRoom(currentRoom, {
                    type: 'ROOM_UPDATE',
                    room: getRoomSnapshot(currentRoom),
                });
                break;
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom && playerId) {
            currentRoom.players.delete(playerId);
            if (currentRoom.players.size === 0) {
                if (currentRoom.tickInterval) clearInterval(currentRoom.tickInterval);
                rooms.delete(currentRoom.code);
            } else {
                // Transfer host if host left
                if (currentRoom.hostId === playerId) {
                    const nextHost = currentRoom.players.values().next().value;
                    if (nextHost) {
                        nextHost.isHost = true;
                        currentRoom.hostId = nextHost.id;
                    }
                }
                broadcastToRoom(currentRoom, {
                    type: 'ROOM_UPDATE',
                    room: getRoomSnapshot(currentRoom),
                });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Skyfall Evasion Server running at http://localhost:${PORT}/`);
    console.log(`WebSocket Server listening for multiplayer matches on port ${PORT}`);
});
