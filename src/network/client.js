/**
 * client.js — WebSocket multiplayer client for Skyfall Evasion
 * 
 * Handles real-time communication with the game server:
 * - Room creation & joining
 * - Team switching & naming
 * - High-frequency player state synchronization
 * - Combat missile launch events & hit confirmations
 * - Pickup collection arbitration
 */

class NetworkClient {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.currentRoom = null;
        this.isConnected = false;
        this.eventListeners = new Map();
        this.ping = 0;
        this.lastPingTime = 0;
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host || 'localhost:8080';
            const wsUrl = `${protocol}//${host}`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.isConnected = true;
                this.trigger('connected');
                resolve();
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.trigger('disconnected');
            };

            this.ws.onerror = (err) => {
                this.trigger('error', 'Connection error');
                reject(err);
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleMessage(msg);
                } catch (e) {
                    console.error('Failed to parse network message', e);
                }
            };
        });
    }

    send(type, data = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        this.ws.send(JSON.stringify({ type, ...data }));
    }

    handleMessage(msg) {
        switch (msg.type) {
            case 'ROOM_JOINED':
                this.playerId = msg.playerId;
                this.currentRoom = msg.room;
                this.trigger('roomJoined', msg);
                break;

            case 'ROOM_UPDATE':
                this.currentRoom = msg.room;
                this.trigger('roomUpdate', msg.room);
                break;

            case 'GAME_STARTED':
                this.currentRoom = msg.room;
                this.trigger('gameStarted', msg.room);
                break;

            case 'TICK_UPDATE':
                this.trigger('tickUpdate', msg);
                break;

            case 'MISSILE_FIRED':
                this.trigger('missileFired', msg.missile);
                break;

            case 'DAMAGE_TAKEN':
                this.trigger('damageTaken', msg);
                break;

            case 'PLAYER_KILLED':
                this.trigger('playerKilled', msg);
                break;

            case 'PLAYER_RESPAWNED':
                this.trigger('playerRespawned', msg.player);
                break;

            case 'PICKUP_COLLECTED':
                this.trigger('pickupCollected', msg);
                break;

            case 'MATCH_ENDED':
                this.trigger('matchEnded', msg);
                break;

            case 'ERROR':
                this.trigger('error', msg.message);
                break;
        }
    }

    // ── Public API ──────────────────────────────────────────
    createRoom(playerName) {
        this.send('CREATE_ROOM', { playerName });
    }

    joinRoom(code, playerName) {
        this.send('JOIN_ROOM', { code, playerName });
    }

    switchTeam(teamIndex) {
        this.send('SWITCH_TEAM', { team: teamIndex });
    }

    setTeamName(teamIndex, name) {
        this.send('SET_TEAM_NAME', { team: teamIndex, name });
    }

    setPlayerName(name) {
        this.send('SET_PLAYER_NAME', { name });
    }

    toggleReady() {
        this.send('TOGGLE_READY');
    }

    startMatch(fillBots = true) {
        this.send('START_MATCH', { fillBots });
    }

    returnToLobby() {
        this.send('RETURN_TO_LOBBY');
    }

    sendPlayerUpdate(playerTransform) {
        this.send('PLAYER_UPDATE', playerTransform);
    }

    fireMissile(targetId, x, y, heading) {
        this.send('FIRE_MISSILE', { targetId, x, y, heading });
    }

    reportHit(targetId, damage, weapon = 'Gunfire') {
        this.send('PLAYER_HIT', { targetId, damage, weapon });
    }

    collectPickup(pickupId) {
        this.send('COLLECT_PICKUP', { pickupId });
    }

    // ── Event Emitter ───────────────────────────────────────
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (!this.eventListeners.has(event)) return;
        const listeners = this.eventListeners.get(event);
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
    }

    trigger(event, data) {
        if (!this.eventListeners.has(event)) return;
        for (const cb of this.eventListeners.get(event)) {
            cb(data);
        }
    }
}

export const net = new NetworkClient();
export default net;
