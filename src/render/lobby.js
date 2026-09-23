/**
 * lobby.js — Modern Glassmorphic Multiplayer Room Lobby UI
 * 
 * Features:
 * - Private Room Creation with 6-character code
 * - Join Room by code
 * - 4 Teams (Alpha, Bravo, Charlie, Delta), 3 players each (12 total max)
 * - Custom Team Renaming
 * - Dynamic slot switching: click any team's open slot to switch teams
 * - Host controls: Auto-fill empty slots with Tactical AI Bots, Launch Match
 */

import net from '../network/client.js?v=2.2';

let lobbyEl = null;
let currentRoomData = null;
let onStartGameCallback = null;

export function initLobby(onStartGame) {
    onStartGameCallback = onStartGame;

    // Create container if not exists
    lobbyEl = document.getElementById('lobbyOverlay');
    if (!lobbyEl) {
        lobbyEl = document.createElement('div');
        lobbyEl.id = 'lobbyOverlay';
        document.body.appendChild(lobbyEl);
        injectLobbyStyles();
    }

    renderMainMenu();

    // Hook network events
    net.on('roomJoined', (data) => {
        currentRoomData = data.room;
        renderRoomLobby();
    });

    net.on('roomUpdate', (room) => {
        currentRoomData = room;
        renderRoomLobby();
    });

    net.on('gameStarted', (room) => {
        currentRoomData = room;
        hideLobby();
        if (onStartGameCallback) {
            onStartGameCallback(room);
        }
    });

    net.on('error', (err) => {
        alert(err);
    });
}

export function showLobby() {
    if (lobbyEl) lobbyEl.style.display = 'flex';
}

export function hideLobby() {
    if (lobbyEl) lobbyEl.style.display = 'none';
}

function renderMainMenu() {
    if (!lobbyEl) return;
    showLobby();

    const storedName = localStorage.getItem('skyfall_pilot_name') || `Maverick_${Math.floor(Math.random() * 90 + 10)}`;

    lobbyEl.innerHTML = `
        <div class="lobby-card glass-panel main-menu-card">
            <div class="lobby-badge">MULTI-TEAM DOGFIGHT</div>
            <h1 class="lobby-title">SKYFALL EVASION</h1>
            <p class="lobby-subtitle">12-Player Tactical Squadron Combat (4 Teams × 3 Jets)</p>

            <div class="input-group">
                <label>CALLSIGN (PILOT NAME)</label>
                <input type="text" id="pilotNameInput" value="${storedName}" maxlength="16" placeholder="Enter Call Sign..." />
            </div>

            <div class="btn-row">
                <button id="btnHostRoom" class="btn btn-primary">
                    <span class="btn-icon">⚡</span> HOST PRIVATE ROOM
                </button>
            </div>

            <div class="divider"><span>OR JOIN SQUADRON</span></div>

            <div class="join-row">
                <input type="text" id="roomCodeInput" maxlength="6" placeholder="ROOM CODE" style="text-transform: uppercase;" />
                <button id="btnJoinRoom" class="btn btn-secondary">JOIN ROOM</button>
            </div>

            <div class="divider"><span>SOLO FLIGHT</span></div>
            <button id="btnSinglePlayer" class="btn btn-tertiary">PRACTICE / SINGLE PLAYER</button>
        </div>
    `;

    document.getElementById('pilotNameInput').addEventListener('input', (e) => {
        localStorage.setItem('skyfall_pilot_name', e.target.value);
    });

    document.getElementById('btnHostRoom').addEventListener('click', async () => {
        const name = document.getElementById('pilotNameInput').value.trim() || 'Commander';
        await net.connect();
        net.createRoom(name);
    });

    document.getElementById('btnJoinRoom').addEventListener('click', async () => {
        const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        if (!code) {
            alert('Please enter a 6-character room code.');
            return;
        }
        const name = document.getElementById('pilotNameInput').value.trim() || 'Pilot';
        await net.connect();
        net.joinRoom(code, name);
    });

    document.getElementById('btnSinglePlayer').addEventListener('click', () => {
        hideLobby();
        if (onStartGameCallback) {
            onStartGameCallback(null); // single player
        }
    });
}

function renderRoomLobby() {
    if (!lobbyEl || !currentRoomData) return;
    showLobby();

    const isHost = currentRoomData.hostId === net.playerId;
    const roomCode = currentRoomData.code;
    const totalPlayers = currentRoomData.players.length;

    const teamCardsHtml = currentRoomData.teamNames.map((teamName, teamIdx) => {
        const teamColor = currentRoomData.teamColors[teamIdx];
        const teamPlayers = currentRoomData.players.filter(p => p.team === teamIdx);

        // 3 slots per team
        const slotsHtml = [0, 1, 2].map(slotIdx => {
            const player = teamPlayers[slotIdx];
            if (player) {
                const isMe = player.id === net.playerId;
                return `
                    <div class="player-slot filled ${isMe ? 'is-me' : ''}">
                        <div class="slot-status-dot" style="background:${player.isReady ? '#34c759' : '#ff9500'}"></div>
                        <span class="slot-name">${player.name} ${player.isHost ? '👑' : ''} ${player.isBot ? '🤖' : ''}</span>
                        ${isMe ? '<span class="you-tag">YOU</span>' : ''}
                    </div>
                `;
            } else {
                return `
                    <div class="player-slot empty btn-switch-team" data-team="${teamIdx}">
                        <span class="empty-text">+ JOIN SLOT</span>
                    </div>
                `;
            }
        }).join('');

        return `
            <div class="team-card" style="border-top: 4px solid ${teamColor};">
                <div class="team-header">
                    <input type="text" class="team-name-input" data-team="${teamIdx}" value="${teamName}" maxlength="20" title="Click to rename team" />
                    <span class="team-count" style="color: ${teamColor}">${teamPlayers.length}/3</span>
                </div>
                <div class="slots-container">
                    ${slotsHtml}
                </div>
            </div>
        `;
    }).join('');

    lobbyEl.innerHTML = `
        <div class="lobby-card glass-panel room-lobby-card">
            <div class="room-topbar">
                <div class="room-code-badge">
                    <span>ROOM CODE:</span>
                    <strong id="btnCopyCode" title="Click to copy">${roomCode} 📋</strong>
                </div>
                <div class="room-stats">
                    <span>${totalPlayers}/12 PILOTS IN BRIEFING</span>
                </div>
            </div>

            <div class="teams-grid">
                ${teamCardsHtml}
            </div>

            <div class="room-footer">
                <button id="btnLeaveRoom" class="btn btn-secondary">LEAVE ROOM</button>
                <div class="host-controls">
                    ${isHost ? `
                        <label class="bot-checkbox-label">
                            <input type="checkbox" id="chkFillBots" checked />
                            <span>Auto-fill empty slots with Tactical AI Bots</span>
                        </label>
                        <button id="btnStartGame" class="btn btn-primary btn-launch">
                            🚀 LAUNCH MISSION (${totalPlayers}/12)
                        </button>
                    ` : `
                        <span class="waiting-text">Waiting for Squadron Host to launch mission...</span>
                    `}
                </div>
            </div>
        </div>
    `;

    // Copy room code
    document.getElementById('btnCopyCode').addEventListener('click', () => {
        navigator.clipboard.writeText(roomCode);
        alert(`Room Code ${roomCode} copied to clipboard! Share it with friends.`);
    });

    // Team rename listeners
    document.querySelectorAll('.team-name-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const team = parseInt(e.target.dataset.team, 10);
            const name = e.target.value.trim();
            if (name) {
                net.setTeamName(team, name);
            }
        });
    });

    // Team switch buttons
    document.querySelectorAll('.btn-switch-team').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const team = parseInt(btn.dataset.team, 10);
            net.switchTeam(team);
        });
    });

    // Leave room
    document.getElementById('btnLeaveRoom').addEventListener('click', () => {
        location.reload();
    });

    // Host Launch Game
    const btnStart = document.getElementById('btnStartGame');
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            const fillBots = document.getElementById('chkFillBots').checked;
            net.startMatch(fillBots);
        });
    }
}

function injectLobbyStyles() {
    const style = document.createElement('style');
    style.textContent = `
        #lobbyOverlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: radial-gradient(circle at center, rgba(15, 23, 42, 0.94) 0%, rgba(10, 10, 30, 0.98) 100%);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color: #f8fafc;
        }

        .glass-panel {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
        }

        .main-menu-card {
            width: 480px;
            max-width: 95vw;
            padding: 40px;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .lobby-badge {
            align-self: center;
            background: rgba(96, 213, 255, 0.15);
            color: #60d5ff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 2px;
            padding: 4px 12px;
            border-radius: 999px;
            border: 1px solid rgba(96, 213, 255, 0.3);
        }

        .lobby-title {
            font-size: 36px;
            font-weight: 900;
            letter-spacing: 1px;
            background: linear-gradient(135deg, #ffffff 30%, #60d5ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin: 0;
        }

        .lobby-subtitle {
            color: #94a3b8;
            font-size: 14px;
            margin-top: -6px;
            margin-bottom: 12px;
        }

        .input-group {
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .input-group label {
            font-size: 11px;
            letter-spacing: 1.5px;
            font-weight: 700;
            color: #94a3b8;
        }

        input[type="text"] {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 8px;
            padding: 12px 16px;
            color: #ffffff;
            font-size: 15px;
            outline: none;
            transition: all 0.2s;
        }

        input[type="text"]:focus {
            border-color: #60d5ff;
            box-shadow: 0 0 0 3px rgba(96, 213, 255, 0.2);
        }

        .btn {
            border: none;
            border-radius: 8px;
            padding: 14px 20px;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #007aff 0%, #0056b3 100%);
            color: #ffffff;
            box-shadow: 0 4px 14px rgba(0, 122, 255, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 122, 255, 0.6);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.08);
            color: #f8fafc;
            border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .btn-tertiary {
            background: transparent;
            color: #64748b;
            font-size: 12px;
            padding: 10px;
        }

        .btn-tertiary:hover {
            color: #94a3b8;
        }

        .divider {
            display: flex;
            align-items: center;
            text-align: center;
            color: #64748b;
            font-size: 11px;
            letter-spacing: 1.5px;
            font-weight: 700;
            margin: 6px 0;
        }

        .divider::before, .divider::after {
            content: '';
            flex: 1;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .divider span {
            padding: 0 10px;
        }

        .join-row {
            display: flex;
            gap: 10px;
        }

        .join-row input {
            flex: 1;
            text-align: center;
            font-family: monospace;
            font-size: 16px;
            letter-spacing: 2px;
        }

        /* ── Room Lobby Layout ────────────────────────────── */
        .room-lobby-card {
            width: 1080px;
            max-width: 95vw;
            padding: 30px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .room-topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 16px;
        }

        .room-code-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #94a3b8;
        }

        .room-code-badge strong {
            color: #60d5ff;
            font-family: monospace;
            font-size: 20px;
            background: rgba(96, 213, 255, 0.12);
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            border: 1px dashed rgba(96, 213, 255, 0.4);
        }

        .teams-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
        }

        @media (max-width: 860px) {
            .teams-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .team-card {
            background: rgba(15, 23, 42, 0.6);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .team-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
        }

        .team-name-input {
            background: transparent;
            border: none;
            color: #ffffff;
            font-weight: 800;
            font-size: 14px;
            padding: 4px 6px;
            width: 100%;
            border-radius: 4px;
        }

        .team-name-input:hover, .team-name-input:focus {
            background: rgba(255, 255, 255, 0.1);
        }

        .team-count {
            font-weight: 800;
            font-size: 13px;
        }

        .slots-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .player-slot {
            height: 48px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            padding: 0 12px;
            gap: 10px;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .player-slot.filled {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .player-slot.filled.is-me {
            border-color: #60d5ff;
            background: rgba(96, 213, 255, 0.12);
        }

        .player-slot.empty {
            border: 1px dashed rgba(255, 255, 255, 0.2);
            justify-content: center;
            cursor: pointer;
            color: #64748b;
        }

        .player-slot.empty:hover {
            border-color: #60d5ff;
            color: #60d5ff;
            background: rgba(96, 213, 255, 0.08);
        }

        .slot-status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .slot-name {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .you-tag {
            font-size: 10px;
            background: #60d5ff;
            color: #0f172a;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 800;
        }

        .room-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 20px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .host-controls {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .bot-checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: #94a3b8;
            cursor: pointer;
        }

        .btn-launch {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
            padding: 14px 28px;
            font-size: 15px;
        }

        .btn-launch:hover {
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.6);
        }
    `;
    document.head.appendChild(style);
}
